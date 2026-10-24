export default function FolderBreadcrumb({ breadcrumbs, navigateToFolder, itemCount, search = '', currentFolder, onAddItem }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F3F4F6] bg-white px-4 py-3 shadow-sm">
      <nav aria-label="Folder location" className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold">
        <button
          type="button"
          onClick={() => navigateToFolder(-1)}
          className={`rounded-lg px-2 py-1.5 transition-colors ${breadcrumbs.length ? 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#A0604E]' : 'text-[#A0604E]'}`}
        >
          All items
        </button>
        {breadcrumbs.map((folder, index) => (
          <span key={folder.id} className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-[#D1D5DB]">/</span>
            {index === breadcrumbs.length - 1 ? (
              <span aria-current="page" className="max-w-[220px] truncate rounded-lg bg-[#FDF5F3] px-2 py-1.5 text-[#A0604E]">{folder.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => navigateToFolder(index)}
                className="max-w-[220px] truncate rounded-lg px-2 py-1.5 text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#A0604E]"
              >
                {folder.name}
              </button>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]" aria-live="polite">
          {itemCount === 0
            ? (search.trim() ? 'No matching items' : 'This folder is empty')
            : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
        </span>
        {currentFolder && onAddItem && (
          <button
            type="button"
            onClick={onAddItem}
            aria-label={`Add an item to ${currentFolder.name}`}
            className="rounded-xl border border-[#A0604E]/20 bg-[#FDF5F3] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#A0604E] transition-colors hover:bg-[#A0604E] hover:text-white"
          >
            + Add item here
          </button>
        )}
      </div>
    </div>
  );
}
