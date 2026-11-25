export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, _req, res, _next) {
  if (error.name === "ValidationError") {
    return res.status(400).json({
      message: "Please check the submitted information.",
      details: Object.values(error.errors).map((item) => item.message)
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "value";
    return res.status(409).json({ message: `That ${field} is already registered.` });
  }

  if (error.name === "CastError") {
    return res.status(400).json({ message: "The supplied record ID is invalid." });
  }

  if (error.message?.includes("not allowed to access")) {
    return res.status(403).json({ message: error.message });
  }

  console.error(error);
  return res.status(error.status || 500).json({
    message: error.status ? error.message : "An unexpected server error occurred."
  });
}
