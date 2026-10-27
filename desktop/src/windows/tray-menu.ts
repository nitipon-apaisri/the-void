import type { MenuItemConstructorOptions } from "electron";

import { PLAYER_STATUSES, STATUS_LABELS, type PlayerStatus } from "@void/shared";

export interface TrayActions {
  open(): void;
  quit(): void;
  setStatus(status: PlayerStatus): void;
}

/** The tray's menu: open the window, pick a status, quit. The current status is ticked. */
export function trayMenuTemplate(
  current: PlayerStatus,
  actions: TrayActions,
): MenuItemConstructorOptions[] {
  return [
    { label: "Open The Void", click: actions.open },
    { type: "separator" },
    ...PLAYER_STATUSES.map((status): MenuItemConstructorOptions => ({
      label: STATUS_LABELS[status],
      type: "radio",
      checked: status === current,
      click: () => actions.setStatus(status),
    })),
    { type: "separator" },
    { label: "Quit The Void", click: actions.quit },
  ];
}
