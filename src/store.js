const mongoose = require('mongoose');

const tenancySchema = new mongoose.Schema(
  {
    _id:         { type: String },
    propertyId:  { type: String, required: true },
    landlordId:  { type: String, required: true },
    tenantId:    { type: String, required: true },
    startDate:   { type: String, required: true },
    endDate:     { type: String, default: null },
    monthlyRent: { type: Number, required: true },
    status:      { type: String, default: 'PENDING', enum: ['PENDING', 'ACTIVE', 'TERMINATED', 'EXPIRED'] },
  },
  { timestamps: true }
);

const Tenancy = mongoose.model('Tenancy', tenancySchema);

async function getAll() {
  return Tenancy.find().lean();
}

async function getById(id) {
  return Tenancy.findById(id).lean();
}

async function create(data) {
  const doc = await Tenancy.create({ _id: data.id, ...data });
  return doc.toObject();
}

async function update(id, updates) {
  return Tenancy.findByIdAndUpdate(id, updates, { new: true }).lean();
}

async function remove(id) {
  await Tenancy.findByIdAndDelete(id);
}

module.exports = { getAll, getById, create, update, remove };
