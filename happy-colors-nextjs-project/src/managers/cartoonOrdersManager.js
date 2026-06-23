import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

async function assertCartoonOrderResponse(response, fallbackMessage) {
  const data = await readResponseJsonSafely(response);

  if (!response.ok) {
    const error = createResponseError(data?.message || fallbackMessage, data);

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function createManagerError(message, response, data = null) {
  const error = new Error(message);

  error.status = response.status;
  error.data = data;

  return error;
}

export async function createCartoonOrderUploadSession() {
  const response = await fetch('/api/cartoon-orders/upload-session', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createManagerError(
      data?.message || 'Upload session creation failed.',
      response,
      data
    );
  }

  return data;
}

export async function createCartoonOrder(payload) {
  const response = await fetch(`${baseURL}/cartoon-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await readResponseJsonSafely(response);

  if (!response.ok) {
    throw createManagerError(
      data?.message || 'Cartoon order could not be created.',
      response,
      data
    );
  }

  return data;
}

export async function fetchCartoonOrders({ includeArchived = false } = {}) {
  const searchParams = new URLSearchParams();

  if (includeArchived) {
    searchParams.set('includeArchived', 'true');
  }

  const url = `${baseURL}/cartoon-orders${searchParams.toString() ? `?${searchParams}` : ''}`;
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
  });

  return assertCartoonOrderResponse(
    response,
    'РќРµСѓСЃРїРµС€РЅРѕ Р·Р°СЂРµР¶РґР°РЅРµ РЅР° С€Р°СЂР¶ РїРѕСЂСЉС‡РєРёС‚Рµ.'
  );
}

export async function updateCartoonOrderStatuses(orderId, statuses) {
  const response = await fetch(`${baseURL}/cartoon-orders/${orderId}/statuses`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ statuses }),
  });

  return assertCartoonOrderResponse(
    response,
    'РќРµСѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІСЏРІР°РЅРµ РЅР° СЃС‚Р°С‚СѓСЃР°.'
  );
}

export async function updateCartoonOrderAdminNotes(orderId, adminNotes) {
  const response = await fetch(`${baseURL}/cartoon-orders/${orderId}/admin-notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ adminNotes }),
  });

  return assertCartoonOrderResponse(
    response,
    'РќРµСѓСЃРїРµС€РЅРѕ Р·Р°РїР°Р·РІР°РЅРµ РЅР° Р°РґРјРёРЅ Р±РµР»РµР¶РєРёС‚Рµ.'
  );
}

export async function updateCartoonOrderWorkflow(orderId, workflowStatus) {
  const response = await fetch(`${baseURL}/cartoon-orders/${orderId}/workflow`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ workflowStatus }),
  });

  return assertCartoonOrderResponse(
    response,
    'Cartoon order workflow could not be updated.'
  );
}

export async function rejectCartoonOrder(orderId) {
  const response = await fetch(`${baseURL}/cartoon-orders/${orderId}/reject`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  return assertCartoonOrderResponse(
    response,
    'Cartoon order could not be rejected.'
  );
}

export async function purgeOldCompletedCartoonOrders() {
  const response = await fetch(`${baseURL}/cartoon-orders/purge-old-completed`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  return assertCartoonOrderResponse(
    response,
    'Old completed cartoon orders could not be deleted.'
  );
}

export async function fetchCartoonUploadCleanupStatus() {
  const response = await fetch(`${baseURL}/cartoon-orders/upload-cleanup/status`, {
    credentials: 'include',
    cache: 'no-store',
  });

  return assertCartoonOrderResponse(
    response,
    'Cartoon upload cleanup status could not be loaded.'
  );
}

export async function runCartoonUploadCleanup({
  recordlessSweep = true,
  reconcileByteGauge = true,
} = {}) {
  const response = await fetch(`${baseURL}/cartoon-orders/upload-cleanup/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({ recordlessSweep, reconcileByteGauge }),
  });

  return assertCartoonOrderResponse(
    response,
    'Cartoon upload cleanup could not be run.'
  );
}

export async function completeCartoonOrder(orderId) {
  const response = await fetch(`${baseURL}/cartoon-orders/${orderId}/complete`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  return assertCartoonOrderResponse(
    response,
    'РќРµСѓСЃРїРµС€РЅРѕ РїСЂРёРєР»СЋС‡РІР°РЅРµ РЅР° С€Р°СЂР¶ РїРѕСЂСЉС‡РєР°С‚Р°.'
  );
}

export async function retryCartoonOrderNotifications(orderId) {
  const response = await fetch(`${baseURL}/cartoon-orders/${orderId}/notifications/retry`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });

  return assertCartoonOrderResponse(
    response,
    'Неуспешно повторно изпращане на известията за шарж поръчката.'
  );
}

export async function uploadCartoonOrderPhoto({ file, uploadSessionToken }) {
  const formData = new FormData();

  formData.append('uploadSessionToken', uploadSessionToken);
  formData.append('file', file);

  const response = await fetch('/api/cartoon-orders/uploads', {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createManagerError(
      data?.message || 'Cartoon order upload failed.',
      response,
      data
    );
  }

  return data;
}

export async function cleanupCartoonOrderUploadedPhotos({
  uploadSessionToken,
  uploadConfirmationTokens,
}) {
  const response = await fetch('/api/cartoon-orders/uploads/cleanup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      uploadSessionToken,
      uploadConfirmationTokens,
    }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createManagerError(
      data?.message || 'Cartoon order upload cleanup failed.',
      response,
      data
    );
  }

  return data;
}
