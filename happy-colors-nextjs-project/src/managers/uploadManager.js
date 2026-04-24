// src/managers/uploadManager.js

export async function uploadImageToBucket(file) {
  if (!file) {
    throw new Error('Не е избран файл.');
  }

  const formData = new FormData();
  formData.append('file', file);

  let res;

  try {
    res = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    console.error('Network error when calling /api/upload-image:', err);
    throw new Error('Възникна грешка при качването на изображението.');
  }

  if (!res.ok) {
    let msg = 'Възникна грешка при качването на изображението.';

    try {
      const data = await res.json();
      if (data?.message) {
        msg = data.message;
      }
    } catch {
      // Ignore JSON parse errors and keep the generic message.
    }

    throw new Error(msg);
  }

  let data;

  try {
    data = await res.json();
  } catch (err) {
    console.error('Invalid JSON from /api/upload-image:', err);
    throw new Error('Възникна грешка при качването на изображението.');
  }

  if (!data?.imageUrl) {
    console.error('No imageUrl in /api/upload-image response:', data);
    throw new Error('Възникна грешка при качването на изображението.');
  }

  return data.imageUrl;
}

export async function uploadImagesToBucket(files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploadedImageUrls = [];

  for (const file of files) {
    const imageUrl = await uploadImageToBucket(file);
    uploadedImageUrls.push(imageUrl);
  }

  return uploadedImageUrls;
}

async function requestSignedUpload({ kind, file }) {
  const res = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kind,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }),
  });

  let data = null;

  try {
    data = await res.json();
  } catch {
    // Ignore JSON parse errors and use the generic message below.
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Възникна грешка при подготовка на качването.');
  }

  if (!data?.uploadUrl || !data?.formFields || !data?.publicUrl || !data?.objectName || !data?.deleteToken) {
    throw new Error('Неочакван отговор при подготовка на качването.');
  }

  return data;
}

async function uploadFileViaProxy({ kind, file }) {
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file);

  const res = await fetch('/api/uploads/proxy', {
    method: 'POST',
    body: formData,
  });

  let data = null;

  try {
    data = await res.json();
  } catch {
    // Ignore JSON parse errors and keep the generic message below.
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Възникна грешка при качването към storage.');
  }

  if (!data?.publicUrl || !data?.objectName || !data?.deleteToken) {
    throw new Error('Неочакван отговор от proxy upload route-а.');
  }

  return {
    publicUrl: data.publicUrl,
    objectName: data.objectName,
    deleteToken: data.deleteToken,
  };
}

export async function uploadSignedFile({ kind, file }) {
  // Video and poster uploads go through the proxy route by default.
  // This avoids browser-to-GCS CORS failures during create/edit flows.
  if (kind === 'video' || kind === 'poster') {
    return uploadFileViaProxy({ kind, file });
  }

  const signedUpload = await requestSignedUpload({ kind, file });
  const formData = new FormData();

  for (const [key, value] of Object.entries(signedUpload.formFields)) {
    formData.append(key, value);
  }

  formData.append('file', file);

  let uploadRes;

  try {
    uploadRes = await fetch(signedUpload.uploadUrl, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    console.error('Network error when uploading directly to GCS:', err);
    return uploadFileViaProxy({ kind, file });
  }

  if (!uploadRes.ok) {
    return uploadFileViaProxy({ kind, file });
  }

  return {
    publicUrl: signedUpload.publicUrl,
    objectName: signedUpload.objectName,
    deleteToken: signedUpload.deleteToken,
  };
}

export async function deleteSignedUploadedFile(objectName, deleteToken) {
  if (!objectName) {
    return;
  }

  const res = await fetch('/api/uploads/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ objectName, deleteToken }),
  });

  if (!res.ok) {
    throw new Error('Не успяхме да изчистим незаписания upload от storage.');
  }
}
