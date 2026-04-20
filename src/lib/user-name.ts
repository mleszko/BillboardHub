type UserMetadata = Record<string, unknown> | null | undefined;

type ResolveUserFirstNameOptions = {
  demo: boolean;
  demoSessionName?: string | null;
  profileFullName?: string | null;
  userEmail?: string | null;
  userMetadata?: UserMetadata;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function firstToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const token = raw.trim().split(/\s+/).filter(Boolean)[0];
  if (!token) return null;
  return capitalize(token);
}

function firstNameFromMetadata(metadata: UserMetadata): string | null {
  if (!metadata) return null;
  const keys = ["full_name", "name", "first_name", "given_name"] as const;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string") {
      const token = firstToken(value);
      if (token) return token;
    }
  }
  return null;
}

function firstNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const localPart = email.trim().split("@")[0];
  if (!localPart) return null;
  const token = localPart.split(/[._-]+/).find(Boolean);
  return firstToken(token ?? null);
}

export function resolveUserFirstName(options: ResolveUserFirstNameOptions): string | null {
  if (options.demo) {
    return firstToken(options.demoSessionName);
  }
  return (
    firstToken(options.profileFullName) ??
    firstNameFromMetadata(options.userMetadata) ??
    firstNameFromEmail(options.userEmail)
  );
}
