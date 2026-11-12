"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category, GraphData, PersonAttributes } from "./types";
import {
  addConnectedPerson as applyConnectedPerson,
  addPerson,
  addRelationship,
  claimPerson as applyClaim,
  confirmRelationship as applyConfirmation,
  emptyGraph,
  makeId,
  removePerson,
  removeRelationship,
  renamePerson,
  setAttributes as applyAttributes,
  setRelationship,
  updateRelationshipCategory,
} from "./store-core";
import {
  canRestoreClaimedPerson,
  clearClaimedPersonId,
  readClaimedPersonId,
  saveClaimedPersonId,
} from "./identity";
import {
  canConnectPair,
  canEditProfile,
  canEditRelationship,
} from "./permissions";
import { GraphRepository } from "./supabase/repository";
import { reduceRealtimeGraph } from "./supabase/realtime";

export interface GraphStoreValue {
  data: GraphData;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  claimedPersonId: string | null;
  addPerson: (name: string) => string | null;
  addConnectedPerson: (name: string, category: Category) => string | null;
  renamePerson: (personId: string, name: string) => void;
  removePerson: (personId: string) => void;
  setAttributes: (personId: string, attributes: PersonAttributes) => void;
  claimPerson: (personId: string, token: string) => Promise<boolean>;
  restoreClaimedPerson: (personId: string, token: string) => boolean;
  addRelationship: (personAId: string, personBId: string, category: Category) => void;
  updateRelationshipCategory: (relationshipId: string, category: Category) => void;
  confirmRelationship: (relationshipId: string) => void;
  removeRelationship: (relationshipId: string) => void;
  setRelationship: (aId: string, bId: string, category: Category | null) => void;
  reload: () => Promise<void>;
}

const GraphStoreContext = createContext<GraphStoreValue | null>(null);

export function GraphStoreProvider({ children }: { children: React.ReactNode }) {
  const repository = useMemo(() => new GraphRepository(), []);
  const [data, setData] = useState<GraphData>(emptyGraph);
  const dataRef = useRef(data);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimedPersonId, setClaimedPersonId] = useState<string | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const graph = await repository.load();
      const storedPersonId = readClaimedPersonId();
      const validPersonId = graph.people.some(
        (person) => person.id === storedPersonId && person.claimed,
      )
        ? storedPersonId
        : null;
      if (!validPersonId && storedPersonId) clearClaimedPersonId();
      setClaimedPersonId(validPersonId);
      dataRef.current = graph;
      setData(graph);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load Circle.");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void reload();
    }, 0);
    const unsubscribe = repository.subscribe((event) => {
      setData((current) => {
        const next = reduceRealtimeGraph(current, event);
        dataRef.current = next;
        return next;
      });
    });
    return () => {
      window.clearTimeout(initialLoad);
      unsubscribe();
    };
  }, [reload, repository]);

  const optimistic = useCallback(
    (
      transform: (current: GraphData) => GraphData,
      write: (next: GraphData, before: GraphData) => Promise<void>,
    ) => {
      const before = dataRef.current;
      const next = transform(before);
      if (next === before) return false;
      dataRef.current = next;
      setData(next);
      void write(next, before).catch((cause) => {
        setError(cause instanceof Error ? cause.message : "A shared update failed.");
        void reload();
      });
      return true;
    },
    [reload],
  );

  const value: GraphStoreValue = {
    data,
    hydrated: !loading,
    loading,
    error,
    claimedPersonId,
    reload,
    addPerson: useCallback(
      (name) => {
        if (
          !claimedPersonId ||
          !dataRef.current.people.some(
            (person) => person.id === claimedPersonId && person.claimed,
          )
        ) {
          return null;
        }
        const id = makeId("p");
        const changed = optimistic(
          (current) => addPerson(current, name, id),
          async (next) => {
            const person = next.people.find((candidate) => candidate.id === id);
            if (person) await repository.insertPerson(person);
          },
        );
        return changed ? id : null;
      },
      [claimedPersonId, optimistic, repository],
    ),
    addConnectedPerson: useCallback(
      (name, category) => {
        if (
          !claimedPersonId ||
          !dataRef.current.people.some(
            (person) => person.id === claimedPersonId && person.claimed,
          )
        ) {
          return null;
        }

        const personId = makeId("p");
        const changed = optimistic(
          (current) =>
            applyConnectedPerson(
              current,
              claimedPersonId,
              name,
              category,
              personId,
            ),
          async (next) => {
            const person = next.people.find(
              (candidate) => candidate.id === personId,
            );
            const relationship = next.relationships.find(
              (candidate) =>
                (candidate.personAId === claimedPersonId &&
                  candidate.personBId === personId) ||
                (candidate.personAId === personId &&
                  candidate.personBId === claimedPersonId),
            );
            if (!person || !relationship) {
              throw new Error("Unable to prepare the new connection.");
            }
            await repository.insertConnectedPerson(person, relationship);
          },
        );
        return changed ? personId : null;
      },
      [claimedPersonId, optimistic, repository],
    ),
    renamePerson: useCallback(
      (id, name) => {
        if (!canEditProfile(claimedPersonId, id)) return;
        optimistic(
          (current) => renamePerson(current, id, name),
          async (next) => {
            const person = next.people.find((candidate) => candidate.id === id);
            if (person) await repository.updatePerson(id, { name: person.name });
          },
        );
      },
      [claimedPersonId, optimistic, repository],
    ),
    removePerson: useCallback(
      (id) => {
        if (!canEditProfile(claimedPersonId, id)) return;
        optimistic((current) => removePerson(current, id), () => repository.deletePerson(id));
      },
      [claimedPersonId, optimistic, repository],
    ),
    setAttributes: useCallback(
      (id, attributes) => {
        if (!canEditProfile(claimedPersonId, id)) return;
        optimistic(
          (current) => applyAttributes(current, id, attributes),
          () => repository.updatePerson(id, attributes),
        );
      },
      [claimedPersonId, optimistic, repository],
    ),
    claimPerson: useCallback(
      async (id, token) => {
        const before = dataRef.current;
        const next = applyClaim(before, id, token);
        if (next === before) return false;
        dataRef.current = next;
        setData(next);
        try {
          const claimed = await repository.claimPerson(id, token);
          if (!claimed) throw new Error("This claim link has already been used.");
          saveClaimedPersonId(id);
          setClaimedPersonId(id);
          return true;
        } catch (cause) {
          dataRef.current = before;
          setData(before);
          setError(cause instanceof Error ? cause.message : "Claim failed.");
          return false;
        }
      },
      [repository],
    ),
    restoreClaimedPerson: useCallback((id, token) => {
      if (!canRestoreClaimedPerson(dataRef.current, id, token)) return false;

      saveClaimedPersonId(id);
      setClaimedPersonId(id);
      return true;
    }, []),
    addRelationship: useCallback(
      (a, b, category) => {
        if (!claimedPersonId || !canConnectPair(claimedPersonId, a, b)) return;
        const proposer = claimedPersonId;
        optimistic(
          (current) => addRelationship(current, a, b, category, proposer),
          async (next) => {
            const relationship = next.relationships.find(
              (candidate) =>
                (candidate.personAId === a && candidate.personBId === b) ||
                (candidate.personAId === b && candidate.personBId === a),
            );
            if (relationship) await repository.insertRelationship(relationship);
          },
        );
      },
      [claimedPersonId, optimistic, repository],
    ),
    updateRelationshipCategory: useCallback(
      (id, category) => {
        const relationship = dataRef.current.relationships.find(
          (candidate) => candidate.id === id,
        );
        if (!relationship || !canEditRelationship(claimedPersonId, relationship)) return;
        optimistic(
          (current) => updateRelationshipCategory(current, id, category),
          () => repository.updateRelationship(id, { category }),
        );
      },
      [claimedPersonId, optimistic, repository],
    ),
    confirmRelationship: useCallback(
      (id) => {
        if (!claimedPersonId) return;
        optimistic(
          (current) => applyConfirmation(current, id, claimedPersonId),
          () => repository.updateRelationship(id, { confirmed: true }),
        );
      },
      [claimedPersonId, optimistic, repository],
    ),
    removeRelationship: useCallback(
      (id) => {
        const relationship = dataRef.current.relationships.find(
          (candidate) => candidate.id === id,
        );
        if (!relationship || !canEditRelationship(claimedPersonId, relationship)) return;
        optimistic(
          (current) => removeRelationship(current, id),
          () => repository.deleteRelationship(id),
        );
      },
      [claimedPersonId, optimistic, repository],
    ),
    setRelationship: useCallback(
      (a, b, category) => {
        if (!claimedPersonId || !canConnectPair(claimedPersonId, a, b)) return;
        const before = dataRef.current;
        const proposer = claimedPersonId;
        const existing = before.relationships.find(
          (relationship) =>
            (relationship.personAId === a && relationship.personBId === b) ||
            (relationship.personAId === b && relationship.personBId === a),
        );
        optimistic(
          (current) => setRelationship(current, a, b, category, proposer),
          async (next) => {
            if (category === null && existing) {
              await repository.deleteRelationship(existing.id);
            } else if (existing) {
              await repository.updateRelationship(existing.id, { category: category! });
            } else {
              const relationship = next.relationships.find(
                (candidate) =>
                  (candidate.personAId === a && candidate.personBId === b) ||
                  (candidate.personAId === b && candidate.personBId === a),
              );
              if (relationship) await repository.insertRelationship(relationship);
            }
          },
        );
      },
      [claimedPersonId, optimistic, repository],
    ),
  };

  return <GraphStoreContext.Provider value={value}>{children}</GraphStoreContext.Provider>;
}

export function useGraphStore(): GraphStoreValue {
  const context = useContext(GraphStoreContext);
  if (!context) throw new Error("useGraphStore must be used within a GraphStoreProvider");
  return context;
}
