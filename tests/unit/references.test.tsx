// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { References } from "@/components/document/sections/References"

afterEach(cleanup)

describe("References", () => {
  it("renders the placeholder string when locked", () => {
    render(<References references={{ private: "references", public: "Available on request" }} />)
    expect(screen.getByText("Available on request")).toBeTruthy()
    expect(screen.queryByRole("list")).toBeNull()
  })

  it("renders the list when unlocked", () => {
    render(
      <References
        references={[{ id: "a", name: "A Referee", title: "Director", contact: "a@example.com" }]}
      />,
    )
    expect(screen.getByText("A Referee")).toBeTruthy()
    expect(screen.getByRole("list")).toBeTruthy()
  })

  it("shows no lock affordance when locked, because a collection is not a scalar", () => {
    const { container } = render(
      <References references={{ private: "references", public: "Available on request" }} />,
    )
    expect(container.querySelector("[data-locked]")).toBeNull()
  })
})
