import { Router } from "express";
import mongoose from "mongoose";
import {
  Supplier, Customer, StockReturn, Product, StockMovement,
  User, AuditLog, roles
} from "../models/index.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";
import { writeAudit } from "../utils/audit.js";

const router = Router();
router.use(requireAuth);

// Suppliers
router.get("/suppliers", allowRoles("Admin", "Manager", "Storekeeper"), async (_req, res, next) => {
  try {
    res.json({ suppliers: await Supplier.find().sort({ name: 1 }) });
  } catch (error) { next(error); }
});

router.post("/suppliers", allowRoles("Admin", "Manager"), async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    await writeAudit(req.user, "SUPPLIER_CREATED", supplier.name);
    res.status(201).json({ supplier });
  } catch (error) { next(error); }
});

router.patch("/suppliers/:id", allowRoles("Admin", "Manager"), async (req, res, next) => {
  try {
    const fields = ["name", "contact", "phone", "email", "items", "status", "notes"];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.includes(key)));
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ message: "Supplier not found." });
    await writeAudit(req.user, "SUPPLIER_UPDATED", supplier.name);
    res.json({ supplier });
  } catch (error) { next(error); }
});

router.delete("/suppliers/:id", allowRoles("Admin", "Manager"), async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ message: "Supplier not found." });
    await writeAudit(req.user, "SUPPLIER_DELETED", supplier.name);
    res.json({ message: "Supplier deleted." });
  } catch (error) { next(error); }
});

// Customers
router.get("/customers", allowRoles("Admin", "Manager", "Cashier"), async (_req, res, next) => {
  try {
    res.json({ customers: await Customer.find().sort({ name: 1 }) });
  } catch (error) { next(error); }
});

router.post("/customers", allowRoles("Admin", "Manager", "Cashier"), async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    await writeAudit(req.user, "CUSTOMER_CREATED", customer.name);
    res.status(201).json({ customer });
  } catch (error) { next(error); }
});

router.patch("/customers/:id", allowRoles("Admin", "Manager", "Cashier"), async (req, res, next) => {
  try {
    const fields = ["name", "phone", "email", "notes"];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => fields.includes(key)));
    const customer = await Customer.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    await writeAudit(req.user, "CUSTOMER_UPDATED", customer.name);
    res.json({ customer });
  } catch (error) { next(error); }
});

router.delete("/customers/:id", allowRoles("Admin", "Manager"), async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found." });
    await writeAudit(req.user, "CUSTOMER_DELETED", customer.name);
    res.json({ message: "Customer deleted." });
  } catch (error) { next(error); }
});

// Returns
router.get("/returns", allowRoles("Admin", "Manager", "Cashier", "Storekeeper"), async (_req, res, next) => {
  try {
    res.json({ returns: await StockReturn.find().sort({ date: -1 }).limit(500) });
  } catch (error) { next(error); }
});

router.post("/returns", allowRoles("Admin", "Manager", "Cashier"), async (req, res, next) => {
  try {
    const { productId, customer, qty, reason, refund = 0 } = req.body;
    const amount = Number(qty);
    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(amount) || amount < 1 || !customer || !reason) {
      return res.status(400).json({ message: "Customer, product, reason and a valid quantity are required." });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const record = await StockReturn.create({
      reference: `RET-${Date.now()}`,
      customer,
      product: product._id,
      productName: product.name,
      qty: amount,
      reason,
      refund: Number(refund),
      by: req.user.role,
      byName: req.user.name
    });

    await writeAudit(req.user, "RETURN_REGISTERED", record.reference);
    res.status(201).json({ stockReturn: record });
  } catch (error) { next(error); }
});

router.patch("/returns/:id/status", async (req, res, next) => {
  const nextStatus = String(req.body.status || "");
  const canReview = ["Admin", "Manager"].includes(req.user.role);
  const canRestock = ["Admin", "Manager", "Storekeeper"].includes(req.user.role);

  if (nextStatus === "approved" || nextStatus === "rejected") {
    if (!canReview) return res.status(403).json({ message: "Only Admin or Manager can review returns." });
  } else if (nextStatus === "restocked") {
    if (!canRestock) return res.status(403).json({ message: "Your role cannot restock returned goods." });
  } else {
    return res.status(400).json({ message: "Choose approved, rejected or restocked." });
  }

  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const record = await StockReturn.findById(req.params.id).session(session);
      if (!record) {
        const error = new Error("Return not found.");
        error.status = 404;
        throw error;
      }

      if (nextStatus === "approved" || nextStatus === "rejected") {
        if (record.status !== "pending") {
          const error = new Error("This return has already been reviewed.");
          error.status = 409;
          throw error;
        }
        record.status = nextStatus;
        await record.save({ session });
      } else {
        if (record.status !== "approved") {
          const error = new Error("Only an approved return can be restocked.");
          error.status = 409;
          throw error;
        }
        const product = await Product.findById(record.product).session(session);
        if (!product) {
          const error = new Error("The product linked to this return no longer exists.");
          error.status = 404;
          throw error;
        }

        product.qty += record.qty;
        await product.save({ session });

        await StockMovement.create([{
          reference: `MV-${Date.now()}`,
          product: product._id,
          productName: product.name,
          type: "stockIn",
          qty: record.qty,
          unitPrice: product.price,
          total: 0,
          date: new Date(),
          by: req.user.role,
          byName: req.user.name
        }], { session });

        record.status = "restocked";
        await record.save({ session });
      }

      await writeAudit(req.user, `RETURN_${nextStatus.toUpperCase()}`, record.reference, session);
      updated = record;
    });

    res.json({ stockReturn: updated });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

// User administration. Password hashes are never returned by these endpoints.
router.get("/users", allowRoles("Admin"), async (_req, res, next) => {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: 1 });
    res.json({ users });
  } catch (error) { next(error); }
});

router.post("/users", allowRoles("Admin"), async (req, res, next) => {
  try {
    const { username, name, password, role } = req.body;
    if (!username || !name || String(password || "").length < 8 || !roles.includes(role)) {
      return res.status(400).json({ message: "Provide a valid username, name, role and password of at least 8 characters." });
    }

    const user = await User.create({ username, name, role, passwordHash: password });
    await writeAudit(req.user, "USER_CREATED", user.username);
    res.status(201).json({
      user: { id: user._id, username: user.username, name: user.name, role: user.role, blocked: user.blocked }
    });
  } catch (error) { next(error); }
});

router.patch("/users/:id/block", allowRoles("Admin"), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot block the account you are currently using." });
    }

    const nextBlocked = Boolean(req.body.blocked);
    if (user.role === "Admin" && !user.blocked && nextBlocked) {
      const activeAdmins = await User.countDocuments({ role: "Admin", blocked: false });
      if (activeAdmins <= 1) {
        return res.status(409).json({ message: "At least one active Admin account must remain." });
      }
    }

    user.blocked = nextBlocked;
    await user.save();
    await writeAudit(req.user, nextBlocked ? "USER_BLOCKED" : "USER_UNBLOCKED", user.username);
    res.json({
      user: { id: user._id, username: user.username, name: user.name, role: user.role, blocked: user.blocked }
    });
  } catch (error) { next(error); }
});

router.patch("/users/:id/password", allowRoles("Admin"), async (req, res, next) => {
  try {
    const password = String(req.body.password || "");
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    user.passwordHash = password;
    await user.save();
    await writeAudit(req.user, "USER_PASSWORD_RESET", user.username);
    res.json({ message: "Password reset successfully." });
  } catch (error) { next(error); }
});

// Audit history
router.get("/audit", allowRoles("Admin", "Manager"), async (_req, res, next) => {
  try {
    const entries = await AuditLog.find().sort({ createdAt: -1 }).limit(500);
    res.json({ audit: entries });
  } catch (error) { next(error); }
});

export default router;
