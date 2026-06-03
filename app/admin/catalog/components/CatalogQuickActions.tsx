import { CARD, PRIMARY_BUTTON } from "../catalogAdminConstants";

type CatalogQuickActionsProps = {
  busy: boolean;
  onAddItem: () => void;
};

export default function CatalogQuickActions({ busy, onAddItem }: CatalogQuickActionsProps) {
  return (
    <section className={CARD} aria-labelledby="catalog-quick-actions-heading">
      <h2 id="catalog-quick-actions-heading" className="text-sm font-semibold text-slate-900">
        Quick actions
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onAddItem} disabled={busy} className={PRIMARY_BUTTON}>
          Add catalog item
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Custom items do not receive starter seed keys. Deactivated items stay in the catalog for
        later reactivation. Use Show inactive in the item filters below to include them.
      </p>
    </section>
  );
}
