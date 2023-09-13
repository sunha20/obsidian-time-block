import { get, writable } from "svelte/store";

import { currentTime } from "../../../global-stores/current-time";
import { settingsWithUtils } from "../../../global-stores/settings-with-utils";
import { basePlanItem } from "../use-task.test";

import { EditMode } from "./types";
import { useEdit } from "./use-edit";
import { timeToMinutes } from "../../../util/moment";

const baseTasks = [basePlanItem];

function getBaseUseTaskProps() {
  const cursorOffsetY = writable(0);
  return {
    settings: settingsWithUtils,
    currentTime,
    cursorOffsetY,
    onUpdate: jest.fn(),
    onMouseUp: jest.fn(),
  };
}

describe("drag one & common edit mechanics", () => {
  test("with no edit in progress, tasks don't change", () => {
    const { cursorOffsetY } = getBaseUseTaskProps();

    const { displayedTasks } = useEdit({
      pointerOffsetY: cursorOffsetY,
      parsedTasks: baseTasks,
      settings: settingsWithUtils.settings,
    });

    cursorOffsetY.set(200);

    expect(get(displayedTasks)).toEqual(baseTasks);
  });

  test("when drag starts, target task reacts to cursor", () => {
    const { cursorOffsetY } = getBaseUseTaskProps();

    const { displayedTasks, startEdit } = useEdit({
      pointerOffsetY: cursorOffsetY,
      parsedTasks: baseTasks,
      settings: settingsWithUtils.settings,
    });

    startEdit(basePlanItem, EditMode.DRAG);
    cursorOffsetY.set(timeToMinutes("09:00"));

    const [updatedItem] = get(displayedTasks);

    expect(updatedItem).toMatchObject({
      startMinutes: timeToMinutes("09:00"),
      endMinutes: timeToMinutes("10:00"),
    });
  });

  test("after edit confirmation, tasks freeze and stop reacting to cursor", () => {
    const { cursorOffsetY } = getBaseUseTaskProps();

    const { displayedTasks, startEdit, confirmEdit } = useEdit({
      pointerOffsetY: cursorOffsetY,
      parsedTasks: baseTasks,
      settings: settingsWithUtils.settings,
    });

    startEdit(basePlanItem, EditMode.DRAG);
    cursorOffsetY.set(timeToMinutes("09:00"));
    confirmEdit();
    cursorOffsetY.set(timeToMinutes("10:00"));

    const [updatedItem] = get(displayedTasks);

    expect(updatedItem).toMatchObject({
      startMinutes: timeToMinutes("09:00"),
      endMinutes: timeToMinutes("10:00"),
    });
  });
});

describe("drag many", () => {
  test("tasks below react to shifting selected task once they start overlap", () => {
    const tasks = [
      basePlanItem,
      {
        ...basePlanItem,
        startMinutes: timeToMinutes("01:10"),
        endMinutes: timeToMinutes("02:10"),
        id: "2",
      }, // todo: can replace with getter
    ];

    const { cursorOffsetY } = getBaseUseTaskProps();

    const { displayedTasks, startEdit } = useEdit({
      pointerOffsetY: cursorOffsetY,
      parsedTasks: tasks,
      settings: settingsWithUtils.settings,
    });

    startEdit(basePlanItem, EditMode.DRAG_AND_SHIFT_OTHERS);
    cursorOffsetY.set(timeToMinutes("01:10"));

    const [, next] = get(displayedTasks);

    expect(next).toMatchObject({
      startMinutes: timeToMinutes("02:10"),
      endMinutes: timeToMinutes("03:10"),
    });
  });

  test.todo(
    "tasks below stay in initial position once the overlap is reversed",
  );

  test.todo("tasks above react to shifting in the same way");

  test.todo("tasks stop moving once there is not enough time");
});

describe("drag one with pushing neighbor", () => {});
