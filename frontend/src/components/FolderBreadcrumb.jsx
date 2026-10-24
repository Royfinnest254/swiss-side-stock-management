export default function FolderBreadcrumb({ breadcrumbs, navigateToFolder, itemCount, search = '' }) {
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
      <span className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]" aria-live="polite">
        {itemCount === 0
          ? (search.trim() ? 'No matching items' : 'This folder is empty')
          : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
      </span>
    </div>
  );
}
