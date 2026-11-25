import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema, model } = mongoose;
const roles = ["Admin", "Manager", "Cashier", "Storekeeper"];

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 24,
    match: /^[a-z0-9._-]+$/
  },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  role: { type: String, enum: roles, required: true, default: "Storekeeper" },
  passwordHash: { type: String, required: true, select: false },
  blocked: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.pre("save", async function () {
  if (this.isModified("passwordHash")) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
});

userSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

const productSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  qty: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  min: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  price: { type: Number, required: true, default: 0, min: 0 },
  icon: { type: String, default: "📦" },
  archived: { type: Boolean, default: false }
}, { timestamps: true });

const movementSchema = new Schema({
  reference: { type: String, required: true, unique: true },
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  type: { type: String, enum: ["stockIn", "stockOut"], required: true },
  qty: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },
  date: { type: Date, default: Date.now },
  by: { type: String, required: true },
  byName: { type: String, required: true }
}, { timestamps: true });

const requestSchema = new Schema({
  reference: { type: String, required: true, unique: true },
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  qty: { type: Number, required: true, min: 1, validate: Number.isInteger },
  status: { type: String, enum: ["pending", "approved", "rejected", "processed"], default: "pending" },
  requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  requestedByName: { type: String, required: true },
  processedBy: { type: String, default: "" },
  notes: { type: String, default: "", maxlength: 500 }
}, { timestamps: true });

const supplierSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  contact: { type: String, trim: true, default: "" },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, lowercase: true, trim: true, default: "" },
  items: { type: String, default: "" },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  notes: { type: String, default: "", maxlength: 500 }
}, { timestamps: true });

const customerSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, lowercase: true, trim: true, default: "" },
  notes: { type: String, default: "", maxlength: 500 }
}, { timestamps: true });

const returnSchema = new Schema({
  reference: { type: String, required: true, unique: true },
  customer: { type: String, required: true, trim: true },
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  qty: { type: Number, required: true, min: 1, validate: Number.isInteger },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  refund: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["pending", "approved", "rejected", "restocked"], default: "pending" },
  date: { type: Date, default: Date.now },
  by: { type: String, required: true },
  byName: { type: String, required: true }
}, { timestamps: true });

const auditSchema = new Schema({
  actor: { type: Schema.Types.ObjectId, ref: "User" },
  actorName: { type: String, required: true },
  role: { type: String, enum: roles, required: true },
  action: { type: String, required: true, maxlength: 120 },
  target: { type: String, default: "", maxlength: 240 },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

export const User = mongoose.models.User || model("User", userSchema);
export const Product = mongoose.models.Product || model("Product", productSchema);
export const StockMovement = mongoose.models.StockMovement || model("StockMovement", movementSchema);
export const StockRequest = mongoose.models.StockRequest || model("StockRequest", requestSchema);
export const Supplier = mongoose.models.Supplier || model("Supplier", supplierSchema);
export const Customer = mongoose.models.Customer || model("Customer", customerSchema);
export const StockReturn = mongoose.models.StockReturn || model("StockReturn", returnSchema);
export const AuditLog = mongoose.models.AuditLog || model("AuditLog", auditSchema);
export { roles };
