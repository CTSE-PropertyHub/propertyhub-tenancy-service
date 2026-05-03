const { v4: uuidv4 } = require('uuid');
const store = require('./store');

const VALID_STATUSES    = ['PENDING', 'ACTIVE', 'REJECTED', 'COMPLETED', 'TERMINATED', 'EXPIRED'];
const LANDLORD_STATUSES = ['ACTIVE', 'REJECTED'];           // landlord can approve or reject a bid
const TENANT_STATUSES   = ['COMPLETED', 'TERMINATED'];      // tenant can accept or walk away

const PROPERTY_SERVICE_URL = process.env.PROPERTY_SERVICE_URL || 'http://propertyhub-property-service';

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
  if (Object.keys(fields).length > 0) {
    throw httpError(400, 'Validation failed', fields);
  }
}

// Fetches a property from the property service and returns the JSON body.
async function fetchProperty(propertyId, userId, userRole) {
  let res;
  try {
    res = await fetch(`${PROPERTY_SERVICE_URL}/properties/${encodeURIComponent(propertyId)}`, {
      headers: { 'X-User-Id': userId, 'X-User-Role': userRole },
    });
  } catch {
    throw httpError(502, 'Property service unavailable');
  }
  if (res.status === 404) throw httpError(422, 'Validation failed', { propertyId: 'propertyId does not exist' });
  if (!res.ok) throw httpError(502, 'Property service returned an error');
  return res.json();
}

// Updates the property status via the property service.
async function updatePropertyStatus(propertyId, status, landlordId) {
  try {
    await fetch(`${PROPERTY_SERVICE_URL}/properties/${encodeURIComponent(propertyId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id':   landlordId,
        'X-User-Role': 'Landlord',
      },
      body: JSON.stringify({ status }),
    });
  } catch {
    // Best-effort — don't fail the tenancy update if the property update fails
  }
}

async function listTenancies(userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  if (userRole === 'Admin')    return store.getAll();
  if (userRole === 'Landlord') return store.getAll().then(all => all.filter(t => t.landlordId === userId));
  if (userRole === 'Tenant')   return store.getAll().then(all => all.filter(t => t.tenantId   === userId));
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

// Tenant submits a rental bid for a property.
// landlordId and listed price are resolved from the property service.
// Tenant may override the listed price with their own bid amount.
async function createTenancy(body, userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  if (userRole !== 'Tenant') throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
  validate(body, ['propertyId', 'startDate', 'monthlyRent']);

  if (typeof body.monthlyRent !== 'number' || body.monthlyRent <= 0) {
    throw httpError(400, 'Validation failed', { monthlyRent: 'monthlyRent must be a positive number' });
  }

  const property = await fetchProperty(body.propertyId, userId, userRole);

  return store.create({
    id:          uuidv4(),
    propertyId:  body.propertyId,
    landlordId:  property.landlordId,
    tenantId:    userId,
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

  // Admin: full control
  if (userRole === 'Admin') {
    return store.update(id, { status });
  }

  // Landlord: approve (ACTIVE) or reject (REJECTED) — only for their own properties
  if (userRole === 'Landlord' && tenancy.landlordId === userId) {
    if (!LANDLORD_STATUSES.includes(status)) {
      throw httpError(403, 'Landlords can only approve (ACTIVE) or reject (REJECTED) a tenancy request');
    }
    const updated = await store.update(id, { status });
    // Approving one bid → auto-reject all other PENDING bids for the same property
    if (status === 'ACTIVE') {
      await store.rejectOtherPending(tenancy.propertyId, id);
    }
    return updated;
  }

  // Tenant: accept the deal (COMPLETED) or walk away (TERMINATED) — only their own tenancy
  if (userRole === 'Tenant' && tenancy.tenantId === userId) {
    if (!TENANT_STATUSES.includes(status)) {
      throw httpError(403, 'Tenants can only complete (accept) or terminate (walk away from) their tenancy');
    }
    const updated = await store.update(id, { status });
    if (status === 'COMPLETED') {
      await updatePropertyStatus(tenancy.propertyId, 'RENTED', tenancy.landlordId);
    } else if (status === 'TERMINATED') {
      await updatePropertyStatus(tenancy.propertyId, 'AVAILABLE', tenancy.landlordId);
    }
    return updated;
  }

  throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
}

async function deleteTenancy(id, userId, userRole) {
  if (!userId || !userRole) throw httpError(403, 'Missing identity headers');
  if (userRole !== 'Admin') throw httpError(403, `Role '${userRole}' is not permitted for this operation`);
  const tenancy = await store.getById(id);
  if (!tenancy) throw httpError(404, `Tenancy not found: ${id}`);
  await store.remove(id);
}

module.exports = { listTenancies, getTenancy, createTenancy, updateStatus, deleteTenancy };
