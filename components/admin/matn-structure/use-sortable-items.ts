"use client";

import * as React from "react";
import { type DragEndEvent } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";

type SortableItem = {
  id: string;
  order: number;
  isArchived: boolean;
};

function hasSameOrder<T extends SortableItem>(left: readonly T[], right: readonly T[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item.id === right[index]?.id)
  );
}

export function useSortableItems<T extends SortableItem>(
  items: readonly T[],
  isBusy: boolean,
  onReorder: (items: readonly T[]) => void
) {
  const activeItems = React.useMemo(
    () => items.filter((item) => !item.isArchived),
    [items]
  );
  const archivedItems = React.useMemo(
    () => items.filter((item) => item.isArchived),
    [items]
  );
  const [orderedItems, setOrderedItems] = React.useState<T[]>(activeItems);

  React.useEffect(() => {
    setOrderedItems([...activeItems]);
  }, [activeItems]);

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled || isBusy) {
      setOrderedItems([...activeItems]);
      return;
    }

    const nextItems = move(activeItems, event) as T[];
    setOrderedItems(nextItems);

    if (!hasSameOrder(nextItems, activeItems)) {
      onReorder(nextItems);
    }
  }

  return { archivedItems, handleDragEnd, orderedItems };
}
