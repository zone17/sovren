import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

describe("Card Component", () => {
  it("renders correctly", () => {
    render(<Card><CardContent>Test content</CardContent></Card>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("has correct styling classes", () => {
    const { container } = render(<Card>Test</Card>);
    expect(container.firstChild).toHaveClass("rounded-lg", "border", "shadow-sm");
  });

  it("card header works", () => {
    render(<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader></Card>);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("card content has correct styling", () => {
    const { container } = render(<Card><CardContent>Content</CardContent></Card>);
    expect(container.querySelector(".p-6")).toBeInTheDocument();
  });
});
