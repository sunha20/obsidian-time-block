import type { Moment } from "moment";
import { TFile } from "obsidian";
import {
  createDailyNote,
  getAllDailyNotes,
  getDailyNote,
  getDateFromFile,
} from "obsidian-daily-notes-interface";
import { get, writable } from "svelte/store";

import { computeOverlap } from "../parser/overlap";
import { parsePlanItems } from "../parser/parser";
import { getTimelineFile } from "../store/active-day";
import { appStore } from "../store/app-store";
import { getHorizontalPlacing } from "../store/horizontal-placing";
import { settings } from "../store/settings";
import { taskLookup, tasks } from "../store/tasks";
import type { PlanItem } from "../types";

import { getNotesForWeek } from "./daily-notes";

export async function openFileInEditor(file: TFile) {
  const app = get(appStore);

  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  return app.workspace.activeEditor?.editor;
}

export async function openFileForDay(moment: Moment) {
  const dailyNote =
    getDailyNote(moment, getAllDailyNotes()) || (await createDailyNote(moment));

  return openFileInEditor(dailyNote);
}

export async function getFileByPath(path: string) {
  const app = get(appStore);

  const file = app.vault.getAbstractFileByPath(path);

  if (!(file instanceof TFile)) {
    throw new Error(`Unable to open file: ${path}`);
  }

  return file;
}

export function addPlacing(planItems: PlanItem[]) {
  const overlapLookup = computeOverlap(planItems);

  return planItems.map((planItem) => ({
    ...planItem,
    placing: getHorizontalPlacing(overlapLookup.get(planItem.id)),
  }));
}

export async function refreshPlanItemsInStore() {
  const notesForWeek = getNotesForWeek();

  const idToPlanItemsStore = await Promise.all(
    notesForWeek.map(async ({ id, note }) => {
      const planItems = note ? await getPlanItemsFromFile(note) : [];
      const planItemsWithPlacing = addPlacing(planItems);
      return [id, writable(planItemsWithPlacing)];
    }),
  );

  const parsedPlanItemsForWeek = Object.fromEntries(idToPlanItemsStore);

  taskLookup.set(parsedPlanItemsForWeek);

  // todo: remove this old code
  const parsedPlanItems = await getPlanItemsFromFile(getTimelineFile());

  tasks.set(parsedPlanItems);
}

async function getPlanItemsFromFile(file: TFile) {
  if (!file) {
    return [];
  }

  const app = get(appStore);
  const { plannerHeading } = get(settings);

  const fileContents = await app.vault.cachedRead(file);
  const metadata = app.metadataCache.getFileCache(file);

  const fileDay = getDateFromFile(file, "day");

  if (!fileDay) {
    throw new Error(
      `Tried to parse plan in file that is not a daily note: ${file.path}`,
    );
  }

  return parsePlanItems(
    fileContents,
    metadata,
    plannerHeading,
    file.path,
    fileDay,
  );
}
