import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TaskForm } from "../pages/TaskForm";
import { defaults } from "../db";
vi.mock("../context", () => ({
  useData: () => ({ tasks: [], categories: defaults, notify: vi.fn() }),
}));
afterEach(cleanup);
it("հայերեն սխալ է ցույց տալիս դատարկ անվանման դեպքում", async () => {
  render(
    <MemoryRouter initialEntries={["/task/new"]}>
      <Routes>
        <Route path="/task/:id" element={<TaskForm />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Պահպանել" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Մուտքագրեք առաջադրանքի անվանումը",
    ),
  );
  expect(screen.getByLabelText(/Անվանում/)).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
