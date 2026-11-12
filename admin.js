/**
 * شُرَاك - لوحة الإدارة
 */

document.addEventListener("DOMContentLoaded", () => {
  // انتظر قليلاً عشان app.js يحمل المستخدم
  setTimeout(initAdmin, 300);
});

async function initAdmin() {
  updateAuthUI();

  if (!currentUser) {
    document.getElementById("adminGuest").classList.remove("hidden");
    document.getElementById("adminDenied").classList.add("hidden");
    document.getElementById("adminPanel").classList.add("hidden");
    return;
  }

  // تحقق من صلاحية الأدمن
  let isAdmin = currentUser.role === "admin";

  // جرب تجيب الدور من Firestore (أدق)
  if (window.SHURAK && window.SHURAK.db) {
    try {
      const doc = await window.SHURAK.db.collection("customers").doc(currentUser.uid).get();
      if (doc.exists && doc.data().role === "admin") {
        isAdmin = true;
        currentUser.role = "admin";
        localStorage.setItem("shurak_user", JSON.stringify(currentUser));
      }
    } catch (e) {
      console.warn("ما قدرنا نتحقق من الدور:", e);
    }
  }

  if (!isAdmin) {
    document.getElementById("adminDenied").classList.remove("hidden");
    document.getElementById("adminGuest").classList.add("hidden");
    document.getElementById("adminPanel").classList.add("hidden");
    return;
  }

  // أدمن → أظهر اللوحة
  document.getElementById("adminPanel").classList.remove("hidden");
  document.getElementById("adminGuest").classList.add("hidden");
  document.getElementById("adminDenied").classList.add("hidden");

  // التبويبات
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".admin-section").forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
    });
  });

  await loadAdminData();
}

async function loadAdminData() {
  let productsList = [];
  let usersList = [];
  let ordersList = [];

  if (window.SHURAK && window.SHURAK.db) {
    try {
      const [pSnap, uSnap, oSnap] = await Promise.all([
        window.SHURAK.db.collection("products").get(),
        window.SHURAK.db.collection("customers").get(),
        window.SHURAK.db.collection("orders").get()
      ]);
      productsList = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      usersList = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      ordersList = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Firestore error, using local:", e.message);
      productsList = JSON.parse(localStorage.getItem("shurak_products") || "[]");
      ordersList = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
    }
  } else {
    productsList = JSON.parse(localStorage.getItem("shurak_products") || "[]");
    ordersList = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
  }

  // إحصائيات
  document.getElementById("statProducts").textContent = productsList.length;
  document.getElementById("statUsers").textContent = usersList.length || "—";
  document.getElementById("statOrders").textContent = ordersList.length;
  document.getElementById("statBanned").textContent = usersList.filter(u => u.banned).length;

  renderAdminProducts(productsList);
  renderAdminUsers(usersList);
  renderAdminOrders(ordersList);
}

function renderAdminProducts(list) {
  const tbody = document.getElementById("adminProductsBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#888">لا توجد منتجات</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.imageUrl ? `<img src="${p.imageUrl}" class="product-thumb" />` : "—"}</td>
      <td>
        <strong>${p.name || "—"}</strong><br>
        <small style="color:#888">${(p.description || "").slice(0, 40)}</small>
      </td>
      <td>${p.price} ر.س</td>
      <td>${p.sellerName || "—"}</td>
      <td>
        <span class="badge ${p.status === "available" ? "badge-green" : "badge-gray"}">
          ${p.status === "available" ? "متاح" : (p.status || "—")}
        </span>
      </td>
      <td>
        <button class="action-btn btn-del" onclick="adminDeleteProduct('${p.id}')">حذف</button>
        <button class="action-btn btn-ban" onclick="adminHideProduct('${p.id}')">إخفاء</button>
      </td>
    </tr>
  `).join("");
}

function renderAdminUsers(list) {
  const tbody = document.getElementById("adminUsersBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#888">لا يوجد عملاء بعد (أو لم يتم جلبهم من Firestore)</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td>${u.name || u.displayName || "—"}</td>
      <td>${u.email || "—"}</td>
      <td>${u.city || "—"}</td>
      <td>
        <span class="badge ${u.banned ? "badge-red" : (u.role === "admin" ? "badge-blue" : "badge-green")}">
          ${u.banned ? "محظور" : (u.role === "admin" ? "أدمن" : "نشط")}
        </span>
      </td>
      <td>
        ${u.role === "admin" ? "—" : `
          ${u.banned 
            ? `<button class="action-btn btn-ok" onclick="adminUnbanUser('${u.id || u.uid}')">إلغاء الحظر</button>`
            : `<button class="action-btn btn-ban" onclick="adminBanUser('${u.id || u.uid}')">حظر</button>`
          }
        `}
      </td>
    </tr>
  `).join("");
}

function renderAdminOrders(list) {
  const tbody = document.getElementById("adminOrdersBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#888">لا توجد طلبات</td></tr>`;
    return;
  }
  // الأحدث أولاً
  list = [...list].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  tbody.innerHTML = list.map(o => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${o.userName || o.userId || "—"}</td>
      <td>${o.total} ر.س</td>
      <td>${o.paymentLabel || o.paymentMethod || "—"}</td>
      <td>
        <span class="badge ${
          o.status === "مكتمل" ? "badge-green" :
          o.status === "تم الرفض" ? "badge-red" :
          o.status === "قيد المراجعة" ? "badge-orange" : "badge-blue"
        }">${o.status || "جديد"}</span>
      </td>
      <td>
        <button class="action-btn btn-ok" onclick="adminUpdateOrder('${o.id}', 'تم القبول')">قبول</button>
        <button class="action-btn btn-ban" onclick="adminUpdateOrder('${o.id}', 'قيد المراجعة')">مراجعة</button>
        <button class="action-btn btn-del" onclick="adminUpdateOrder('${o.id}', 'تم الرفض')">رفض</button>
        <button class="action-btn btn-ok" onclick="adminUpdateOrder('${o.id}', 'مكتمل')">مكتمل</button>
      </td>
    </tr>
  `).join("");
}

// ========== إجراءات ==========
async function adminDeleteProduct(id) {
  if (!confirm("هل تريد حذف هذا المنتج نهائياً؟")) return;
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("products").doc(id).delete();
    }
    // محلي
    let products = JSON.parse(localStorage.getItem("shurak_products") || "[]");
    products = products.filter(p => p.id !== id);
    localStorage.setItem("shurak_products", JSON.stringify(products));
    alert("تم حذف المنتج");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminHideProduct(id) {
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("products").doc(id).update({ status: "hidden" });
    }
    let products = JSON.parse(localStorage.getItem("shurak_products") || "[]");
    products = products.map(p => p.id === id ? { ...p, status: "hidden" } : p);
    localStorage.setItem("shurak_products", JSON.stringify(products));
    alert("تم إخفاء المنتج");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminBanUser(uid) {
  if (!confirm("هل تريد حظر هذا الحساب؟")) return;
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("customers").doc(uid).update({ banned: true });
    }
    alert("تم حظر الحساب");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminUnbanUser(uid) {
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("customers").doc(uid).update({ banned: false });
    }
    alert("تم إلغاء الحظر");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminUpdateOrder(id, status) {
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("orders").doc(id).update({ status });
    }
    let orders = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
    orders = orders.map(o => o.id === id ? { ...o, status } : o);
    localStorage.setItem("shurak_orders", JSON.stringify(orders));
    alert("تم تحديث حالة الطلب إلى: " + status);
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}
