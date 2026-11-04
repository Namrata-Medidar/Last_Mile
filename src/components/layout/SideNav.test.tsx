import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SideNav } from "./SideNav";

afterEach(cleanup);

describe("My Orders navigation permission", () => {
  it("shows My Orders for a non-customer role with permission", () => {
    const onBookingsSelect = vi.fn();
    render(<SideNav role="engineer" canViewMyOrders onBookingsSelect={onBookingsSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "My orders" }));
    expect(onBookingsSelect).toHaveBeenCalledOnce();
  });

  it("hides My Orders for a customer without permission", () => {
    render(<SideNav role="customer" canViewCustomerPortal />);
    expect(screen.queryByRole("button", { name: "My orders" })).not.toBeInTheDocument();
  });
});
