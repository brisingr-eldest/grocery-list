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

const addItemForm = document.getElementById('addItemForm');

let allItems = [];

let currentEditItemId = null;  // null means add mode, otherwise editing this ID

async function fetchItemsWithCategories() {
  const { data: items, error } = await supabase
    .from('items')
    .select(`
      id,
      name,
      notes,
      on_list,
      in_cart,
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
  }));

  renderItems(allItems);
}

function renderItems(items) {
  itemsList.innerHTML = items.map(item => {
    const categoryName = typeof item.category === 'object' ? item.category?.name : item.category || 'Uncategorized';
    const subcategoryName = typeof item.subcategory === 'object' ? item.subcategory?.name : item.subcategory || '';

    return `
      <li data-id="${item.id}" class="flex items-center justify-between mb-2 p-3 bg-white border rounded-lg cursor-pointer">
        <div>
          <div class="font-medium">${item.name}</div>
          <div class="mt-1 flex flex-wrap gap-1 text-sm">
            <span class="category-badge px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">${categoryName}</span>
            ${subcategoryName
              ? `<span class="category-badge px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">${subcategoryName}</span>`
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

async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, parent_id');

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
    // Remove active styling from all buttons
    tabButtons.forEach(btn => {
      btn.classList.remove('bg-white', 'text-stone-900', 'shadow-sm', 'ring-1', 'ring-stone-200');
      btn.classList.add('text-stone-500');
    });

    // Add active styling to clicked button
    button.classList.add('bg-white', 'text-stone-900', 'shadow-sm', 'ring-1', 'ring-stone-200');
    button.classList.remove('text-stone-500');

    // Hide all tab contents
    Object.values(tabContents).forEach(el => el.classList.add('hidden'));

    // Show the selected tab
    const selectedTab = button.dataset.tab;
    tabContents[selectedTab].classList.remove('hidden');

    fetchItemsWithCategories();
  });
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

    setInterval(() => {
      itemNameInput.focus();
      itemNameInput.select();
    }, 10);

  } else {
    itemNameInput.value = '';
  }

  addItemModal.classList.remove('hidden');

});

addItemModal.addEventListener('click', (e) => {
  if(e.target === addItemModal) {
    closeModal()
  }
});

cancelAddItem.addEventListener('click', closeModal);

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
});