import { displayFieldSource } from "../../lib/labels";
import { sourceBadgeClass } from "./detailFields";

export function FieldSourceBadge({
  source,
  active,
  onClick,
}: {
  source: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${sourceBadgeClass(source)}${active ? " is-active" : ""}`}
      onClick={onClick}
    >
      {displayFieldSource(source)}
    </button>
  );
}
