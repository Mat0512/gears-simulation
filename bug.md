# Fix Notes

## Issue 1: Incorrect Gear Being Modified / Deleted

**Description:**
Only the **last gear** can be modified or deleted. In some cases, a gear that was **never added** is selected instead of the intended one.

**Root Cause:**
Gear actions (edit/delete/select) are bound to a shared or global reference, which always points to the last gear in the list rather than the selected gear.

**Fix / Resolution:**

* Ensure each gear has a **unique identifier (ID)**.
* Bind modify/delete actions to the **selected gear's ID**, not the last array index.
* Avoid using mutable shared state when handling gear selection.
* Validate that the selected gear exists before performing actions.

---

## Issue 2: Gear Info Always Displays the Last Added Gear

**Description:**
The gear information panel always shows the **most recently added gear**, regardless of which gear is selected.

**Root Cause:**
The UI state for displaying gear information is tied to the **last inserted gear** instead of the **currently selected gear**.

**Fix / Resolution:**

* Introduce a `selectedGear` state or variable.
* Update gear info display based on `selectedGear`, not on the last added item.
* Trigger gear info updates on **selection change**, not on **add event**.

---

## Expected Behavior After Fix

* Any selected gear can be modified or deleted correctly.
* Gear information updates dynamically based on the selected gear.
* No unintended selection of non-existing or unadded gears.

---

**Status:** Pending Verification
**Priority:** High
**Impact:** Core gear management functionality
