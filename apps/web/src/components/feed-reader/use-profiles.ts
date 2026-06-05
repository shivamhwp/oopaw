import { useEffect, useMemo, useRef } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { toast } from "sonner";
import { api, type Id } from "@/lib/convex";

const ACTIVE_PROFILE_STORAGE_KEY = "oopaw.active-profile-id";

export type ProfileOption = {
  _id: Id<"profiles">;
  name: string;
  createdAt: number;
};

export const activeProfileIdAtom = atomWithStorage<Id<"profiles"> | null>(
  ACTIVE_PROFILE_STORAGE_KEY,
  null,
  undefined,
  { getOnInit: true },
);

export function useProfiles(canReadUserData: boolean) {
  const [activeProfileId, setActiveProfileId] = useAtom(activeProfileIdAtom);
  const hasRequestedEnsureRef = useRef(false);
  const profiles = useConvexQuery(
    api.profiles.queries.listForCurrentUser,
    canReadUserData ? {} : "skip",
  );
  const ensureDefaultProfile = useConvexMutation(
    api.profiles.mutations.ensureDefaultForCurrentUser,
  );
  const createProfile = useConvexMutation(api.profiles.mutations.createForCurrentUser);
  const renameProfile = useConvexMutation(api.profiles.mutations.renameForCurrentUser);
  const profileOptions = useMemo(() => (profiles ?? []) as ProfileOption[], [profiles]);
  const profileIdsKey = profileOptions.map((profile) => profile._id).join("|");
  const selectedProfile =
    profileOptions.find((profile) => profile._id === activeProfileId) ?? profileOptions[0] ?? null;
  const selectedProfileId = selectedProfile?._id ?? null;
  const ensureDefaultMutation = useMutation({
    mutationFn: ensureDefaultProfile,
    onSuccess: (profile) => {
      setActiveProfileId((current) => current ?? profile._id);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not load profiles.");
    },
  });
  const createProfileMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: (profile) => {
      setActiveProfileId(profile._id);
      toast.success(`Created ${profile.name}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not create profile.");
    },
  });
  const renameProfileMutation = useMutation({
    mutationFn: renameProfile,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not rename profile.");
    },
  });

  useEffect(() => {
    if (!canReadUserData) {
      hasRequestedEnsureRef.current = false;
      return;
    }

    if (profiles === undefined || hasRequestedEnsureRef.current) {
      return;
    }

    hasRequestedEnsureRef.current = true;
    ensureDefaultMutation.mutate({});
  }, [canReadUserData, ensureDefaultMutation, profiles, setActiveProfileId]);

  useEffect(() => {
    if (!canReadUserData || profiles === undefined || profileOptions.length === 0) {
      return;
    }

    if (!activeProfileId || !profileOptions.some((profile) => profile._id === activeProfileId)) {
      setActiveProfileId(profileOptions[0]._id);
    }
  }, [
    activeProfileId,
    canReadUserData,
    profileIdsKey,
    profileOptions,
    profiles,
    setActiveProfileId,
  ]);

  const selectProfile = (profileId: Id<"profiles">) => {
    setActiveProfileId(profileId);
  };

  const createNewProfile = async () => {
    await createProfileMutation.mutateAsync({});
  };

  const renameCurrentProfile = async (profileId: Id<"profiles">, name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    await renameProfileMutation.mutateAsync({
      profileId,
      name: trimmedName,
    });
  };

  return {
    profiles: profileOptions,
    selectedProfile,
    selectedProfileId,
    isProfilesLoading: canReadUserData && profiles === undefined,
    isCreatingProfile: createProfileMutation.isPending,
    isRenamingProfile: renameProfileMutation.isPending,
    selectProfile,
    createNewProfile,
    renameCurrentProfile,
  };
}
