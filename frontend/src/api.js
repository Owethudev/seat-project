export async function requestApi(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'The request could not be completed.');
  }

  return data;
}
