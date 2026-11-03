import userEvent from "@testing-library/user-event";

import { setupParameterValuesEndpoints } from "__support__/server-mocks";
import { renderWithProviders, screen, waitFor, within } from "__support__/ui";
import type { UiParameter } from "metabase-lib/v1/parameters/types";
import type { ParameterValueOrArray } from "metabase-types/api";
import {
  createMockParameter,
  createMockParameterValues,
} from "metabase-types/api/mocks";
import {
  createProductsCategoryField,
  createProductsRatingField,
} from "metabase-types/api/mocks/presets";

import { ParameterValueWidget } from "./ParameterValueWidget";

interface SetupOpts {
  parameter?: Partial<UiParameter>;
  value?: ParameterValueOrArray | null;
  enableRequiredBehavior?: boolean;
}

function setup({
  parameter,
  value = null,
  enableRequiredBehavior,
}: SetupOpts = {}) {
  const defaultParameter: UiParameter = {
    ...createMockParameter({
      id: "test-param",
      type: "string/=",
      slug: "text",
      name: "Text",
    }),
    fields: [],
    ...parameter,
  };

  const setValue = jest.fn<void, [ParameterValueOrArray | null]>();
  const setParameterValueToDefault = jest.fn<void, [string]>();

  renderWithProviders(
    <ParameterValueWidget
      parameter={defaultParameter}
      setValue={setValue}
      setParameterValueToDefault={setParameterValueToDefault}
      value={value}
      placeholder="Enter a value"
      enableRequiredBehavior={enableRequiredBehavior}
    />,
  );

  return { setValue, setParameterValueToDefault };
}

describe("ParameterValueWidget", () => {
  it("should let a number filter be typed into when its field has no values to list", async () => {
    setup({
      parameter: {
        ...createMockParameter({
          id: "number-param",
          type: "number/=",
          sectionId: "number",
          slug: "number",
          name: "Number Equals",
        }),
        fields: [createProductsRatingField({ has_field_values: "none" })],
      },
    });

    await userEvent.click(screen.getByTestId("parameter-value-widget-target"));

    expect(
      await screen.findByPlaceholderText("Enter a number"),
    ).toBeInTheDocument();
  });

  it("should apply aria-expanded=true on the trigger button element (#70543)", async () => {
    setup();

    const triggerButton = screen.getByTestId("parameter-value-widget-target");

    // The trigger should be a button element (rendered via UnstyledButton when hasPopover is true)
    expect(triggerButton.tagName).toBe("BUTTON");

    // Before opening, aria-expanded should be false
    expect(triggerButton).toHaveAttribute("aria-expanded", "false");

    // Open the popover
    await userEvent.click(triggerButton);

    // After opening, aria-expanded should be true on the same button
    expect(triggerButton).toHaveAttribute("aria-expanded", "true");
  });

  describe("legacy category parameter", () => {
    it("should list the field values and set the picked one", async () => {
      setupParameterValuesEndpoints(
        createMockParameterValues({
          values: [["Doohickey"], ["Gizmo"]],
          has_more_values: false,
        }),
      );
      const { setValue } = setup({
        parameter: {
          ...createMockParameter({ id: "category-param", type: "category" }),
          fields: [createProductsCategoryField()],
        },
      });

      await userEvent.click(
        screen.getByTestId("parameter-value-widget-target"),
      );
      await userEvent.click(await screen.findByText("Gizmo"));
      await userEvent.click(screen.getByRole("button", { name: "Add filter" }));

      expect(setValue).toHaveBeenCalledTimes(1);
      expect(setValue).toHaveBeenCalledWith(["Gizmo"]);
    });
  });

  describe("boolean parameter", () => {
    const booleanParameter = {
      ...createMockParameter({ id: "boolean-param", type: "boolean/=" }),
      fields: [],
    };

    it("should add a true filter by default", async () => {
      const { setValue } = setup({ parameter: booleanParameter });

      await userEvent.click(
        screen.getByTestId("parameter-value-widget-target"),
      );
      expect(await screen.findByLabelText("True")).toBeChecked();
      await userEvent.click(screen.getByRole("button", { name: "Add filter" }));

      expect(setValue).toHaveBeenCalledTimes(1);
      expect(setValue).toHaveBeenCalledWith([true]);
    });

    it("should update the filter to false", async () => {
      const { setValue } = setup({
        parameter: booleanParameter,
        value: [true],
      });

      await userEvent.click(
        screen.getByTestId("parameter-value-widget-target"),
      );
      await userEvent.click(await screen.findByLabelText("False"));
      await userEvent.click(
        screen.getByRole("button", { name: "Update filter" }),
      );

      expect(setValue).toHaveBeenCalledTimes(1);
      expect(setValue).toHaveBeenCalledWith([false]);
    });
  });

  describe("required field parameter with a default value", () => {
    it("should set the default value back when the value is removed", async () => {
      setupParameterValuesEndpoints(
        createMockParameterValues({
          values: [["Gizmo"], ["Widget"]],
          has_more_values: false,
        }),
      );
      const { setValue } = setup({
        parameter: {
          ...createMockParameter({
            id: "category-param",
            type: "string/=",
            required: true,
            default: ["Gizmo"],
          }),
          fields: [createProductsCategoryField()],
        },
        value: ["Widget"],
        enableRequiredBehavior: true,
      });

      await userEvent.click(
        screen.getByTestId("parameter-value-widget-target"),
      );
      await userEvent.click(
        await within(screen.getByRole("dialog")).findByRole("checkbox", {
          name: "Widget",
        }),
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Set to default" }),
      );

      expect(setValue).toHaveBeenCalledTimes(1);
      expect(setValue).toHaveBeenCalledWith(["Gizmo"]);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });
});
