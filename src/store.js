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
    status:      { type: String, default: 'PENDING', enum: ['PENDING', 'ACTIVE', 'REJECTED', 'COMPLETED', 'TERMINATED', 'EXPIRED'] },
  },
  { timestamps: true }
);

const Tenancy = mongoose.model('Tenancy', tenancySchema);

function toDoc(doc) {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return { id: _id, ...rest };
}

async function getAll() {
  return Tenancy.find().lean().then(docs => docs.map(toDoc));
}

async function getById(id) {
  return Tenancy.findById(id).lean().then(toDoc);
}

async function create(data) {
  const doc = await Tenancy.create({ _id: data.id, ...data });
  return toDoc(doc.toObject());
}

async function update(id, updates) {
  return Tenancy.findByIdAndUpdate(id, updates, { new: true }).lean().then(toDoc);
}

async function remove(id) {
  await Tenancy.findByIdAndDelete(id);
}

// Rejects all PENDING tenancies for a property except the one being approved.
async function rejectOtherPending(propertyId, excludeId) {
  await Tenancy.updateMany(
    { propertyId, status: 'PENDING', _id: { $ne: excludeId } },
    { $set: { status: 'REJECTED' } }
  );
}

module.exports = { getAll, getById, create, update, remove, rejectOtherPending };
