import { supabase } from './supabaseClient';

// ─── Boxes ───

export async function fetchBoxes() {
  const { data, error } = await supabase
    .from('boxes')
    .select('*, items(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchBoxes error:', error);
    return [];
  }
  return data || [];
}

export async function createBox({ name, location }) {
  const { data, error } = await supabase
    .from('boxes')
    .insert({ name, location })
    .select()
    .single();

  if (error) {
    console.error('createBox error:', error);
    return null;
  }
  return data;
}

export async function updateBox(boxId, updates) {
  const { error } = await supabase
    .from('boxes')
    .update(updates)
    .eq('id', boxId);

  if (error) console.error('updateBox error:', error);
}

export async function deleteBox(boxId) {
  // Delete all item photos first
  const { data: items } = await supabase
    .from('items')
    .select('photo_path')
    .eq('box_id', boxId);

  if (items) {
    const paths = items.filter((i) => i.photo_path).map((i) => i.photo_path);
    if (paths.length > 0) {
      await supabase.storage.from('item-photos').remove(paths);
    }
  }

  // Delete items then box (cascade would also work if set up in DB)
  await supabase.from('items').delete().eq('box_id', boxId);
  const { error } = await supabase.from('boxes').delete().eq('id', boxId);
  if (error) console.error('deleteBox error:', error);
}

// ─── Items ───

export async function createItem(boxId, { name, note, qty, photoFile }) {
  let photo_url = null;
  let photo_path = null;

  // Upload photo if provided
  if (photoFile) {
    const ext = 'jpg';
    const fileName = `${boxId}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('item-photos')
      .upload(fileName, photoFile, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Photo upload error:', uploadError);
    } else {
      photo_path = uploadData.path;
      const { data: urlData } = supabase.storage
        .from('item-photos')
        .getPublicUrl(uploadData.path);
      photo_url = urlData.publicUrl;
    }
  }

  const { data, error } = await supabase
    .from('items')
    .insert({
      box_id: boxId,
      name,
      note: note || null,
      qty: qty || 1,
      photo_url,
      photo_path,
    })
    .select()
    .single();

  if (error) {
    console.error('createItem error:', error);
    return null;
  }
  return data;
}

export async function deleteItem(itemId) {
  // Get photo path first
  const { data: item } = await supabase
    .from('items')
    .select('photo_path')
    .eq('id', itemId)
    .single();

  if (item?.photo_path) {
    await supabase.storage.from('item-photos').remove([item.photo_path]);
  }

  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) console.error('deleteItem error:', error);
}

// ─── Image helper ───
// Convert base64 data URL to Blob for upload
export function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}
