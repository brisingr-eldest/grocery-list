import { supabase } from './supabase.js';

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = {
  list: document.getElementById('view-list'),
  items: document.getElementById('view-items')
};

const searchInput = document.getElementById('search');
const addItemBtn = document.getElementById('add-item');
const itemsList = document.getElementById('items-list');
const listView = document.getElementById('view-list');

const addItemModal = document.getElementById('addItemModal');
const cancelAddItem = document.getElementById('cancelAddItem');

let categories = [];

const itemNameInput = document.getElementById('itemName');
const categorySelect = document.getElementById('itemCategory');
const subcategorySelect = document.getElementById('itemSubcategory');
const subcategoryWrapper = document.getElementById('subcategoryWrapper');

const purchaseRepeatCheckbox = document.getElementById('enableInterval');
const intervalWrapper = document.getElementById('intervalInputs');

const addToListCheckbox = document.getElementById('addToListCheckbox');

const deleteItemBtn = document.getElementById('deleteItemBtn');
const addItemForm = document.getElementById('addItemForm');

let allItems = [];

let currentEditItemId = null;  // null means add mode, otherwise editing this ID

let activeCategoryFilter = null;

async function fetchItemsWithCategories() {
  const { data: items, error } = await supabase
    .from('items')
    .select(`
      id,
      name,
      notes,
      on_list,
      in_cart,
      last_purchased,
      purchase_interval_days,
      category:category_id ( id, name ),
      subcategory:subcategory_id ( id, name )
    `)
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  allItems = items.map(item => ({
    id: item.id,
    name: item.name,
    notes: item.notes || '',
    category: item.category?.name || '',
    subcategory: item.subcategory?.name || '',
    on_list: item.on_list,
    in_cart: item.in_cart,
    last_purchased: item.last_purchased, // may be null
    purchase_interval_days: item.purchase_interval_days, // may be null
  }));

  renderItems(allItems);
  renderListView();
  renderSuggestedBar();
  renderClearCartButton();
}

function renderListView() {
  const listContainer = document.getElementById('listContainer');
  const cartContainer = document.getElementById('cartContainer');

  listContainer.innerHTML = '';
  cartContainer.innerHTML = '';

  const listItems = allItems
    .filter(i => i.on_list && !i.in_cart)
    .sort((a, b) => {
      const catA = a.category?.toLowerCase() || '';
      const catB = b.category?.toLowerCase() || '';
      if (catA !== catB) return catA.localeCompare(catB);

      const subA = a.subcategory?.toLowerCase() || '';
      const subB = b.subcategory?.toLowerCase() || '';
      if (subA !== subB) return subA.localeCompare(subB);

      const nameA = a.name?.toLowerCase() || '';
      const nameB = b.name?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });

  const cartItems = allItems.filter(i => i.on_list && i.in_cart);

  // ---- List section ----
  if (listItems.length === 0) {
    const listEmptyMessage = cartItems.length > 0
      ? 'All done! Great work!'
      : 'Nothing on your list yet.';

    listContainer.innerHTML = `
      <div class="flex flex-col text-stone-500">
        <p class="mb-4 italic">${listEmptyMessage}</p>
        <button id="goToItemsBtn" class="inline-block self-center px-4 py-2 bg-stone-700 text-stone-50 rounded-lg hover:bg-stone-600 transition">
          Add Items
        </button>
      </div>
    `;
  } else {
    for (const item of listItems) {
      listContainer.insertAdjacentHTML('beforeend', renderListViewItem(item, false));
    }
  }

  // ---- Cart section ----
  if (cartItems.length === 0) {
    const cartEmptyMessage = listItems.length === 0
      ? 'Nothing in the cart. Add some items to the list to get started.'
      : 'Nothing in the cart. Let’s go shopping!';

    cartContainer.innerHTML = `
      <div class="text-stone-500">
        <p class="italic">${cartEmptyMessage}</p>
      </div>
    `;
  } else {
    for (const item of cartItems) {
      cartContainer.insertAdjacentHTML('beforeend', renderListViewItem(item, true));
    }
  }

  // ---- Wire up Add Items button ----
  const goToItemsBtn = document.getElementById('goToItemsBtn');
  if (goToItemsBtn) {
    goToItemsBtn.addEventListener('click', () => {
      const itemsTabBtn = document.querySelector('[data-tab="items"]');
      itemsTabBtn?.click();
    });
  }
}

function renderListViewItem(item, isCart) {
  const categoryObj = categories.find(c => c.name === item.category);
  const subcategoryObj = categories.find(c => c.name === item.subcategory);

  const categoryTag = item.category
    ? `<span class="text-sm leading-tight px-2 pt-[0.2rem] pb-[0.25rem] rounded-full ${categoryObj?.colors || 'bg-gray-100 text-gray-700'}">${item.category}</span>`
    : '';

  const subcategoryTag = item.subcategory
    ? `<span class="text-sm leading-tight px-2 pt-[0.2rem] pb-[0.25rem] rounded-full ${subcategoryObj?.colors || 'bg-gray-100 text-gray-700'}">${item.subcategory}</span>`
    : '';

  // Cart item: only checkbox + name
  if (isCart) {
    return `
      <div class="flex items-center justify-between gap-4 py-2" data-id="${item.id}">
        <div class="flex items-center gap-3 flex-1 cursor-pointer">
          <div class="flex-shrink-0">
            <label class="flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" ${item.in_cart ? 'checked' : ''}>
              <div class="custom-checkbox w-6 h-6 rounded-full border border-stone-300 flex items-center justify-center 
                          peer-checked:bg-stone-600 peer-checked:border-stone-600 transition">
                <svg class="w-3 h-3 text-white scale-100 peer-checked:scale-100" 
                    fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </label>
          </div>
          <div class="font-medium text-gray-800">${item.name}</div>
        </div>
      </div>
    `;
  }

  // List item: checkbox + name + badges + notes + remove
  return `
    <div class="flex items-center justify-between gap-4 py-2" data-id="${item.id}">
      <div class="flex items-center gap-3 flex-1 cursor-pointer">
        <div class="flex-shrink-0">
          <label class="flex items-center cursor-pointer relative z-0">
            <input type="checkbox" class="sr-only peer" ${item.in_cart ? 'checked' : ''}>
            <div class="custom-checkbox w-6 h-6 z-0 rounded-full border border-stone-300 flex items-center justify-center 
                        peer-checked:bg-stone-600 peer-checked:border-stone-600 transition">
              <svg class="w-3 h-3 z-0 text-white scale-100 peer-checked:scale-100" 
                  fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </label>
        </div>
        <div>
          <div class="font-medium text-gray-800">${item.name}</div>
          <div class="flex flex-wrap gap-1 mt-0.5">
            ${categoryTag}
            ${subcategoryTag}
          </div>
          ${item.notes ? `<div class="text-sm mt-1 line-clamp-2 text-gray-600">${item.notes}</div>` : ''}
        </div>
      </div>
      <button class="text-xs text-stone-500 hover:text-red-600 transition remove-btn" title="Remove from list">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `;
}

function renderItems(items) {
  itemsList.innerHTML = items.map(item => {
    const categoryName = typeof item.category === 'object' ? item.category?.name : item.category || 'Uncategorized';
    const subcategoryName = typeof item.subcategory === 'object' ? item.subcategory?.name : item.subcategory || '';
    const categoryObj = categories.find(c => c.name === categoryName);
    const subcategoryObj = categories.find(c => c.name === subcategoryName);

    return `
      <li data-id="${item.id}" class="flex items-center justify-between mb-2 p-3 bg-white border rounded-lg cursor-pointer">
        <div>
          <div class="font-medium">${item.name}</div>
          <div class="mt-1 flex flex-wrap gap-1 text-sm">
            <span class="category-badge leading-tight px-2 pt-[0.2rem] pb-[0.25rem] rounded-full ${categoryObj?.colors || 'bg-stone-200 text-stone-700'}">${categoryName}</span>
            ${subcategoryName
              ? `<span class="category-badge leading-tight px-2 pt-[0.2rem] pb-[0.25rem] rounded-full ${subcategoryObj?.colors || 'bg-stone-200 text-stone-700'}">${subcategoryName}</span>`
              : ''}
            </div>
          ${item.notes ? `<div class="text-sm mt-1 line-clamp-2">${item.notes}</div>` : ''}
        </div>
        ${item.on_list
          ? `
            <button class="remove-btn inline-flex items-center gap-1 px-2 py-1 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
                  viewBox="0 0 24 24">
                <path d="M20 12H4" />
              </svg>
              Remove
            </button>
          `
          : `
            <button class="add-btn inline-flex items-center gap-1 px-2 py-1 text-sm text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
                  viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          `
        }
      </li>
    `;
  }).join('');
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const last = new Date(dateStr);
  const now = new Date();
  const diffMs = now - last;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getSuggestedItems() {
  return allItems.filter(item => {
    if (item.on_list) return false; // already on list
    if (!item.purchase_interval_days || item.purchase_interval_days <= 0) return false;
    // need last_purchased to exist, otherwise treat as very overdue? spec implies based on last_purchased
    if (!item.last_purchased) return false;

    const elapsed = daysSince(item.last_purchased);
    // suggest when elapsed is >= purchase_interval_days - 3
    return elapsed >= Math.max(0, item.purchase_interval_days - 3);
  });
}

function renderSuggestedBar() {
  const container = document.getElementById('suggested-items');
  const suggestions = getSuggestedItems();

  if (suggestions.length === 0) {
    container.innerHTML = ''; // or placeholder if you want
    return;
  }

  container.innerHTML = suggestions.map(item => `
    <div data-suggest-id="${item.id}" class="inline-block py-1 px-3 bg-stone-700 text-stone-50 rounded-full cursor-pointer hover:bg-stone-800 transition">
      + ${item.name}
    </div>
  `).join('');
}

function renderClearCartButton() {
  const wrapper = document.getElementById('cart-clear-wrapper');
  const cartItems = allItems.filter(i => i.on_list && i.in_cart);
  if (cartItems.length === 0) {
    wrapper.innerHTML = '';
    return;
  }
  wrapper.innerHTML = `
    <button id="clear-cart-btn" class="mt-2 mx-auto inline-flex justify-center gap-2 px-4 py-2 bg-stone-700 text-stone-50 rounded-lg hover:bg-stone-600 font-medium">
      Clear Cart
    </button>
  `;
}


async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, parent_id, colors');

  if (error) {
    console.error('Error loading categories:', error.message);
    return;
  }

  categories = data;

  // Populate top-level categories
  const topLevel = categories.filter(c => !c.parent_id);
  const categorySelect = document.getElementById('itemCategory');
  categorySelect.innerHTML = '<option value="">Select a category</option>';

  topLevel.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    categorySelect.appendChild(option);
  });
}

function openEditModal(item) {
  addItemModal.classList.remove('hidden');

  document.getElementById('modalTitle').textContent = 'Edit Item';
  document.getElementById('submitBtn').textContent = 'Save';

  itemNameInput.value = item.name || '';

  const categoryObj = categories.find(c => c.name === item.category || c.id === item.category);
  categorySelect.value = categoryObj?.id || '';
  categorySelect.dispatchEvent(new Event('change'));
  setTimeout(() => {
    const subcategoryObj = categories.find(c => c.name === item.subcategory && c.parent_id === categoryObj?.id);
    subcategorySelect.value = subcategoryObj?.id || '';
  }, 0);

  document.getElementById('itemNotes').value = item.notes || '';

  const intervalDays = item.purchase_interval_days;
  if (intervalDays && intervalDays > 0) {
    purchaseRepeatCheckbox.checked = true;
    intervalWrapper.classList.remove('hidden');

    let number = intervalDays;
    let unit = 'days';

    if (intervalDays % 30 === 0) {
      number = intervalDays / 30;
      unit = 'months';
    } else if (intervalDays % 7 === 0) {
      number = intervalDays / 7;
      unit = 'weeks';
    }

    document.getElementById('intervalNumber').value = number;
    document.getElementById('intervalUnit').value = unit;
  } else {
    purchaseRepeatCheckbox.checked = false;
    intervalWrapper.classList.add('hidden');
    document.getElementById('intervalNumber').value = '';
    document.getElementById('intervalUnit').value = 'days';
  }

  addToListCheckbox.checked = item.on_list ?? false;
  deleteItemBtn.classList.remove('hidden');

  currentEditItemId = item.id;
}

function closeModal() {
  addItemModal.classList.add('hidden');
}

function toTitleCase(str) {
  const smallWords = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor',
    'on', 'at', 'to', 'from', 'by', 'in', 'of', 'over', 'with'
  ]);

  return str.trim().toLowerCase().split(/\s+/).map((word, i, arr) => {
    // Handle hyphenated words
    const parts = word.split('-').map((part, j, all) => {
      if (
        i === 0 || i === arr.length - 1 || // always capitalize first or last full word
        !smallWords.has(part)
      ) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      } else {
        return part;
      }
    });

    return parts.join('-');
  }).join(' ');
}

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const selectedTab = button.dataset.tab;

    // Update tab UI
    tabButtons.forEach(btn => {
      btn.classList.remove('bg-white', 'text-stone-900', 'shadow-sm', 'ring-1', 'ring-stone-200');
      btn.classList.add('text-stone-500');
    });
    button.classList.add('bg-white', 'text-stone-900', 'shadow-sm', 'ring-1', 'ring-stone-200');
    button.classList.remove('text-stone-500');

    Object.values(tabContents).forEach(el => el.classList.add('hidden'));
    tabContents[selectedTab].classList.remove('hidden');

    // Update URL without reloading
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('tab', selectedTab);
    window.history.replaceState({}, '', newUrl);

    fetchItemsWithCategories();
  });
});

document.getElementById('suggested-items').addEventListener('click', async (e) => {
  const pill = e.target.closest('.suggestion-pill');
  if (!pill) return;

  const itemId = pill.dataset.id;
  try {
    const { error } = await supabase
      .from('items')
      .update({ on_list: true, in_cart: false })
      .eq('id', itemId);
    if (error) {
      console.error('Error adding suggested item to list:', error.message);
    } else {
      await fetchItemsWithCategories(); // will re-render everything including suggested bar
    }
  } catch (err) {
    console.error('Unexpected error adding suggested item:', err);
  }
});

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();

  const filteredItems = allItems.filter(item =>
    item.name.toLowerCase().includes(query)
  );

  renderItems(filteredItems);
});

addItemBtn.addEventListener('click', () => {
  const searchValue = searchInput.value.trim();

  if (searchValue) {
    const titleCased = toTitleCase(searchValue);
    itemNameInput.value = titleCased;

    setTimeout(() => {
      itemNameInput.focus();
      itemNameInput.select();
    }, 10);

    searchInput.value = '';

  } else {
    itemNameInput.value = '';
  }

  addToListCheckbox.checked = true; // default to checked for new items
  deleteItemBtn.classList.add('hidden');

  addItemModal.classList.remove('hidden');

});

addItemModal.addEventListener('click', (e) => {
  if(e.target === addItemModal) {
    closeModal()
  }
});

cancelAddItem.addEventListener('click', closeModal);

deleteItemBtn.addEventListener('click', async () => {
  if (!currentEditItemId) return;

  const confirmed = confirm('Are you sure you want to delete this item? This cannot be undone.');

  if (!confirmed) return;

  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', currentEditItemId);

    if (error) {
      console.error('Error deleting item:', error.message);
      alert('Could not delete item.');
    } else {
      closeModal();
      await fetchItemsWithCategories();
    }
  } catch (err) {
    console.error('Unexpected error deleting item:', err);
    alert('Unexpected error. Check console.');
  }
});

categorySelect.addEventListener('change', () => {
  const selectedId = categorySelect.value;

  const children = categories.filter(cat => cat.parent_id === selectedId);

  if (children.length > 0) {
    subcategoryWrapper.classList.remove('hidden');
    subcategorySelect.innerHTML = '<option value="">Select a subcategory</option>';
    children.forEach(sub => {
      const option = document.createElement('option');
      option.value = sub.id;
      option.textContent = sub.name;
      subcategorySelect.appendChild(option);
    });
  } else {
    subcategoryWrapper.classList.add('hidden');
    subcategorySelect.innerHTML = '';
  }
});

purchaseRepeatCheckbox.addEventListener('change', () => {
  if (purchaseRepeatCheckbox.checked) {
    intervalWrapper.classList.remove('hidden');
  } else {
    intervalWrapper.classList.add('hidden');
  }
});

addItemForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Gather form values
  const name = itemNameInput.value.trim();
  const category_id = categorySelect.value || null;
  const subcategory_id = subcategorySelect.value || null;
  const notes = document.getElementById('itemNotes')?.value.trim() || null;

  const enableInterval = purchaseRepeatCheckbox.checked;
  let purchase_interval_days = null;

  if (enableInterval) {
    const num = parseInt(document.getElementById('intervalNumber').value);
    const unit = document.getElementById('intervalUnit').value;

    const multiplier = unit === 'weeks' ? 7 : unit === 'months' ? 30 : 1;
    purchase_interval_days = num * multiplier;
  }

  const itemData = {
    name,
    category_id,
    subcategory_id,
    notes,
    purchase_interval_days,
    is_archived: false,
    on_list: addToListCheckbox.checked,
    in_cart: false,
  };

  try {
    let response;
    if (currentEditItemId) {
      // Edit mode: update the item by id
      response = await supabase
        .from('items')
        .update(itemData)
        .eq('id', currentEditItemId);
    } else {
      // Add mode: insert new item
      response = await supabase
        .from('items')
        .insert([itemData]);
    }

    const { data, error } = response;

    if (error) {
      console.error('Error saving item:', error.message);
      alert('Error saving item. Check console for details.');
    } else {
      console.log('Item saved:', data);
      addItemForm.reset();
      intervalWrapper.classList.add('hidden');
      closeModal();
      fetchItemsWithCategories();
      renderItems(allItems);
      currentEditItemId = null; // Reset edit ID after saving
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    alert('Unexpected error. Check console for details.');
  }
});

itemsList.addEventListener('click', async (e) => {
  const itemRow = e.target.closest('li[data-id]');
  if (!itemRow) return;

  const itemId = itemRow.dataset.id;

  // Handle Add
  if (e.target.closest('.add-btn')) {
    try {
      const { error } = await supabase
        .from('items')
        .update({ on_list: true, in_cart: false })
        .eq('id', itemId);

      if (error) {
        console.error('Error adding item to list:', error.message);
        alert('Could not add item to list.');
      } else {
        fetchItemsWithCategories(); // Refresh
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Unexpected error. Check console for details.');
    }
    return;
  }

  // Handle Remove
  if (e.target.closest('.remove-btn')) {
    try {
      const { error } = await supabase
        .from('items')
        .update({ on_list: false, in_cart: false })
        .eq('id', itemId);

      if (error) {
        console.error('Error removing item from list:', error.message);
        alert('Could not remove item.');
      } else {
        fetchItemsWithCategories(); // Refresh
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Unexpected error. Check console for details.');
    }
    return;
  }

  // Prevent edit modal from opening on category badge click
  if (e.target.closest('.category-badge')) return;

  // Default: open edit modal
  const item = allItems.find(i => i.id.toString() === itemId.toString());
  if (!item) {
    console.error('Item not found for editing:', itemId);
    return;
  }

  openEditModal(item);
});

document.addEventListener('DOMContentLoaded', async () => {
  const { data, error } = await supabase.from('items').select('*');
  if (error) {
    console.error('Error fetching items:', error.message);
    return;
  }

  await fetchItemsWithCategories();
  loadCategories();

  // Show tab from URL param, or default to 'list'
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'list';
  const tabButton = document.querySelector(`[data-tab="${initialTab}"]`);
  tabButton?.click();
});

document.getElementById('view-list').addEventListener('click', async (e) => {
  // Clear Cart button (no per-item row needed)
  if (e.target.closest('#clear-cart-btn')) {
    const cartItems = allItems.filter(i => i.on_list && i.in_cart);
    if (cartItems.length === 0) return;

    const ids = cartItems.map(i => i.id);
    try {
      const { error } = await supabase
        .from('items')
        .update({
          in_cart: false,
          on_list: false,
          last_purchased: new Date().toISOString()
        })
        .in('id', ids);
      if (error) {
        console.error('Error clearing cart:', error.message);
      } else {
        await fetchItemsWithCategories();
      }
    } catch (err) {
      console.error('Unexpected error clearing cart:', err);
    }
    return;
  }

  // Clicked a suggested item
  const suggested = e.target.closest('[data-suggest-id]');
  if (suggested) {
    const itemId = suggested.dataset.suggestId;
    try {
      const { error } = await supabase
        .from('items')
        .update({ on_list: true, in_cart: false })
        .eq('id', itemId);
      if (error) {
        console.error('Error adding suggested item:', error.message);
      } else {
        await fetchItemsWithCategories();
      }
    } catch (err) {
      console.error('Unexpected error adding suggested item:', err);
    }
    return; // prevent edit modal from opening
  }


  // Per-item interactions: need to find the closest row with data-id
  const itemRow = e.target.closest('[data-id]');
  if (!itemRow) return;
  const itemId = itemRow.dataset.id;

  // Remove from list (the "x" button)
  if (e.target.closest('.remove-btn')) {
    try {
      const { error } = await supabase
        .from('items')
        .update({ on_list: false, in_cart: false })
        .eq('id', itemId);
      if (error) {
        console.error('Error removing item from list:', error.message);
      } else {
        await fetchItemsWithCategories();
      }
    } catch (err) {
      console.error('Unexpected error removing item:', err);
    }
    return;
  }

  // Toggle in_cart via checkbox area (hidden input or styled box)
  if (e.target.closest('input[type="checkbox"]') || e.target.closest('.custom-checkbox')) {
    const item = allItems.find(i => i.id.toString() === itemId.toString());
    if (!item) return;
    const newCartValue = !item.in_cart;
    try {
      const { error } = await supabase
        .from('items')
        .update({ in_cart: newCartValue })
        .eq('id', itemId);
      if (error) {
        console.error('Error toggling cart state:', error.message);
      } else {
        await fetchItemsWithCategories();
      }
    } catch (err) {
      console.error('Unexpected error toggling cart state:', err);
    }
    return;
  }

  // Ignore clicks on badges (category/subcategory)
  if (e.target.closest('.text-xs')) return;

  // Otherwise: open edit modal
  const item = allItems.find(i => i.id.toString() === itemId.toString());
  if (item) {
    openEditModal(item);
  }
});

