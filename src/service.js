const { v4: uuidv4 } = require('uuid');
const store = require('./store');

const VALID_STATUSES = ['PENDING', 'ACTIVE', 'TERMINATED', 'EXPIRED'];

function httpError(status, message, fields) {
  const err = new Error(message);
  err.status = status;
  if (fields) err.fields = fields;
  return err;
}

function validate(body, required) {
  const fields = {};
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      fields[field] = `${field} is required`;
    }
  }
  if (body.monthlyRent !== undefined && (typeof body.monthlyRent !== 'number' || body.monthlyRent <= 0)) {
    fields.monthlyRent = 'monthlyRent must be a positive number';
  }
  if (Object.keys(fields).length > 0) {
    throw httpError(400, 'Validation failed', fields);
  }
}

async function listTenancies(userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  if (userRole === 'Admin') return store.getAll();
  if (userRole === 'Landlord') return store.getAll().then(all => all.filter(t => t.landlordId === userId));
  if (userRole === 'Tenant')   return store.getAll().then(all => all.filter(t => t.tenantId === userId));
  throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
}

async function getTenancy(id, userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  const tenancy = await store.getById(id);
  if (!tenancy) throw httpError(404, `Tenancy not found: ${id}`);
  if (userRole === 'Admin') return tenancy;
  if (tenancy.landlordId === userId || tenancy.tenantId === userId) return tenancy;
  throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
}

async function createTenancy(body, userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  if (userRole !== 'Landlord') throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
  validate(body, ['propertyId', 'tenantId', 'startDate', 'monthlyRent']);
  return store.create({
    id: uuidv4(),
    propertyId:  body.propertyId,
    landlordId:  userId,
    tenantId:    body.tenantId,
    startDate:   body.startDate,
    endDate:     body.endDate || null,
    monthlyRent: body.monthlyRent,
    status:      'PENDING',
  });
}

async function updateStatus(id, status, userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  if (!status) throw httpError(400, 'Validation failed', { status: 'status is required' });
  if (!VALID_STATUSES.includes(status)) {
    throw httpError(400, 'Validation failed', { status: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const tenancy = await store.getById(id);
  if (!tenancy) throw httpError(404, `Tenancy not found: ${id}`);
  if (userRole !== 'Admin' && !(userRole === 'Landlord' && tenancy.landlordId === userId)) {
    throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
  }
  return store.update(id, { status });
}

async function deleteTenancy(id, userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  if (userRole !== 'Admin') throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
  const tenancy = await store.getById(id);
  if (!tenancy) throw httpError(404, `Tenancy not found: ${id}`);
  await store.remove(id);
}

module.exports = { listTenancies, getTenancy, createTenancy, updateStatus, deleteTenancy };
