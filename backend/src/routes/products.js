import { Router } from "express";
import { Product } from "../models/index.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";
import { writeAudit } from "../utils/audit.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res, next) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

router.post("/", allowRoles("Admin", "Manager", "Storekeeper"), async (req, res, next) => {
  try {
    const { name, sku, category, qty = 0, min = 0, price = 0, icon = "📦" } = req.body;
    if (!name || !category) {
      return res.status(400).json({ message: "Product name and category are required." });
    }

    const productSku = String(sku || `UB-${Date.now()}`).trim().toUpperCase();
    const product = await Product.create({ name, sku: productSku, category, qty, min, price, icon });
    await writeAudit(req.user, "PRODUCT_CREATED", product.name);
    res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", allowRoles("Admin", "Manager"), async (req, res, next) => {
  try {
    const allowed = ["name", "sku", "category", "min", "price", "icon", "archived"];
    const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: "No editable product fields were provided." });
    }

    if (changes.sku) changes.sku = String(changes.sku).trim().toUpperCase();
    const product = await Product.findByIdAndUpdate(req.params.id, changes, {
      new: true,
      runValidators: true
    });

    if (!product) return res.status(404).json({ message: "Product not found." });
    await writeAudit(req.user, "PRODUCT_UPDATED", product.name);
    res.json({ product });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", allowRoles("Admin", "Manager"), async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });
    await writeAudit(req.user, "PRODUCT_DELETED", product.name);
    res.json({ message: "Product deleted." });
  } catch (error) {
    next(error);
  }
});

export default router;
