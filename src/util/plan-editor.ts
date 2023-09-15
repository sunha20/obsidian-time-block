import { difference } from "lodash/fp";
import type { MetadataCache } from "obsidian";

import { getHeadingByText, getListItemsUnderHeading } from "../parser/parser";
import { replaceTimestamp } from "../parser/timestamp/timestamp";
import type { DayPlannerSettings } from "../settings";
import type { PlanItem } from "../types";

import { selectText } from "./editor";
import type { ObsidianFacade } from "./obsidian-facade";
import { isEqualTask } from "./task-utils";

export class PlanEditor {
  constructor(
    private readonly settings: DayPlannerSettings,
    private readonly metadataCache: MetadataCache,
    private readonly obsidianFacade: ObsidianFacade,
  ) {}

  syncWithFile = async (baseline: PlanItem[], updated: PlanItem[]) => {
    const pristine = updated.filter((task) =>
      baseline.find((baselineTask) => isEqualTask(task, baselineTask)),
    );

    const dirty = difference(updated, pristine);

    const promises = dirty.map((task) => {
      const taskIsInFile = task.location.line !== undefined;

      if (taskIsInFile) {
        return this.updateTask(task);
      }

      return this.appendToPlan(task);
    });

    return Promise.all(promises);
  };

  createPlannerHeading() {
    const { plannerHeading, plannerHeadingLevel } = this.settings;

    const headingTokens = "#".repeat(plannerHeadingLevel);

    return `${headingTokens} ${plannerHeading}`;
  }

  // todo: we might want to update not only duration. Better: syncTaskWithNote
  async updateTask(task: PlanItem) {
    await this.obsidianFacade.editFile(task.location.path, (contents) => {
      return contents
        .split("\n")
        .map((line, i) => {
          // todo: if a task is newly created, it's not going to have a line. We need a clearer way to track this information
          if (i === task.location?.line) {
            // todo: this may break if I don't sync duration manually everywhere. Need a getter for endMinutes
            return replaceTimestamp(task, {
              startMinutes: task.startMinutes,
              durationMinutes: task.durationMinutes,
            });
          }

          return line;
        })
        .join("\n");
    });
  }

  // todo: replace with mdast-util-from-markdown + custom stringify
  // todo: push obsidian internals into facade
  async appendToPlan(planItem: PlanItem) {
    const { plannerHeading } = this.settings;

    const file = this.obsidianFacade.getFileByPath(planItem.location.path);
    const editor = await this.obsidianFacade.openFileInEditor(file);

    const metadata = this.metadataCache.getFileCache(file) || {};

    let line = editor.lastLine();
    let result = replaceTimestamp(planItem, { ...planItem });

    const cachedHeading = getHeadingByText(metadata, plannerHeading);

    if (cachedHeading) {
      line = cachedHeading.position.start.line;
    } else {
      result = `${this.createPlannerHeading()}\n\n${result}`;
    }

    const listItems = getListItemsUnderHeading(metadata, plannerHeading);

    if (listItems?.length > 0) {
      const lastListItem = listItems[listItems.length - 1];

      line = lastListItem.position.start.line;
    } else if (cachedHeading) {
      result = `\n${result}`;
    }

    const ch = editor.getLine(line).length;

    editor.replaceRange(`\n${result}`, { line, ch });

    selectText(editor, planItem.firstLineText);
  }
}