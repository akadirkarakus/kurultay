import packageJson from "@/package.json";

export function VersionBadge() {
  return (
    <span className="fixed bottom-4 left-4 z-40 text-xs text-secondary-muted">
      v{packageJson.version} · Beta
    </span>
  );
}
