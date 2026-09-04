// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { PrivateValue } from "@/components/privacy/PrivateValue"

afterEach(cleanup)

describe("PrivateValue", () => {
  it("renders a real value with no lock state", () => {
    render(<PrivateValue field="steve@example.com" />)
    const node = screen.getByText("steve@example.com")
    expect(node.dataset.locked).toBe("false")
  })

  it("renders the placeholder and marks it locked", () => {
    render(<PrivateValue field={{ private: "contact", public: "Available on request" }} />)
    const node = screen.getByText("Available on request")
    expect(node.dataset.locked).toBe("true")
  })

  it("labels the locked state for assistive technology", () => {
    render(<PrivateValue field={{ private: "contact", public: "Available on request" }} />)
    expect(screen.getByLabelText(/withheld/i)).toBeTruthy()
  })
})
