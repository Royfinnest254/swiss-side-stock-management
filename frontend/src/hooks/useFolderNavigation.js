import { useEffect, useMemo, useState } from 'react';

const sameId = (left, right) => String(left) === String(right);

export function useFolderNavigation(items) {
  const [folderPathIds, setFolderPathIds] = useState([]);
  const foldersById = useMemo(
    () => new Map(items.filter(item => item.is_folder).map(item => [String(item.id), item])),
    [items]
  );

  const breadcrumbs = useMemo(() => {
    const path = [];
    for (const id of folderPathIds) {
      const folder = foldersById.get(String(id));
      if (folder) path.push(folder);
    }
    return path;
  }, [folderPathIds, foldersById]);

  const currentFolder = breadcrumbs.at(-1) || null;

  useEffect(() => {
    if (folderPathIds.length && breadcrumbs.length !== folderPathIds.length) {
      setFolderPathIds(breadcrumbs.map(folder => folder.id));
    }
  }, [breadcrumbs, folderPathIds]);

  const openFolder = (folder) => {
    const ancestors = [];
    let parentId = folder.parent_id;
    while (parentId != null) {
      const parent = foldersById.get(String(parentId));
      if (!parent || ancestors.some(entry => sameId(entry.id, parent.id))) break;
      ancestors.unshift(parent);
      parentId = parent.parent_id;
    }
    setFolderPathIds([...ancestors.map(entry => entry.id), folder.id]);
  };

  const navigateToFolder = (index) => {
    setFolderPathIds(index < 0 ? [] : breadcrumbs.slice(0, index + 1).map(folder => folder.id));
  };

  const getVisibleItems = (filteredItems, searchTerm = '') => {
    // Preserve the existing inventory-wide search so items inside folders
    // remain discoverable without first opening their folder.
    const foldersFirst = (records) => records.slice().sort((left, right) => Number(Boolean(right.is_folder)) - Number(Boolean(left.is_folder)));
    if (searchTerm.trim()) return foldersFirst(filteredItems);

    if (currentFolder) {
      return foldersFirst(filteredItems.filter(item => item.parent_id != null && sameId(item.parent_id, currentFolder.id)));
    }

    // Show root-level records and records whose former parent folder is gone,
    // so older data cannot disappear from the inventory view.
    return foldersFirst(filteredItems.filter(item => {
      if (item.parent_id == null) return true;
      const parent = foldersById.get(String(item.parent_id));
      return !parent;
    }));
  };

  return { breadcrumbs, currentFolder, openFolder, navigateToFolder, getVisibleItems };
}
