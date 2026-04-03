/**
 * firestore.js
 * Firestore helpers for complaint persistence.
 * Uses a FLAT top-level collection 'complaints' for easier global Admin access.
 * email_content is stored but NEVER returned to the frontend.
 */
import {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
} from "./firebase.js";

/**
 * saveComplaint
 * Saves a new complaint to the top-level 'complaints' collection.
 */
export async function saveComplaint(userId, data) {
  try {
    const ref = collection(db, "complaints");
    await addDoc(ref, {
      user_id:       userId,
      user_email:    data.user_email    || "", // For Admin attribution
      complaint_id:  data.complaint_id  || `CIV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      description:   data.description   || "",
      location:      data.location      || "Inferred",
      issue_type:    data.issue_type    || "Unknown",
      department:    data.department    || "Unknown",
      risk_level:    data.risk_level    || "MEDIUM",
      status:        "SENT",
      timestamp:     serverTimestamp(),
      // PRIVATE — never read back to UI
      email_content: data.email_content || "",
    });
    console.log("✅ Complaint saved to global 'complaints' collection");
  } catch (err) {
    console.error("❌ Firestore save failed:", err.message);
  }
}

/**
 * getComplaints
 * Fetches complaints FOR A SPECIFIC USER from the top-level collection.
 */
export async function getComplaints(userId) {
  try {
    const ref = collection(db, "complaints");
    const q   = query(ref, where("user_id", "==", userId), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);

    return snap.docs.map((doc) => {
      const { email_content, user_id, ...safeData } = doc.data(); 
      return {
        id: doc.id,
        ...safeData,
        timestamp: safeData.timestamp?.toDate?.() ?? new Date(),
      };
    });
  } catch (err) {
    console.error("❌ User complaints fetch failed:", err.message);
    return [];
  }
}

/**
 * getAllComplaints
 * Fetches ALL complaints globally (Admin access).
 */
export async function getAllComplaints() {
  try {
    const ref = collection(db, "complaints");
    const q   = query(ref, orderBy("timestamp", "desc"));
    const snap = await getDocs(q);

    return snap.docs.map((doc) => {
      const { email_content, ...data } = doc.data();
      return {
        id: doc.id,
        path: doc.ref.path, // Full path for updates
        ...data,
        timestamp: data.timestamp?.toDate?.() ?? new Date(),
      };
    });
  } catch (err) {
    console.error("❌ Global complaints fetch failed:", err.message);
    return [];
  }
}

/**
 * updateComplaintStatus
 * @param {string} path  - Document path (complaints/ID)
 * @param {string} status
 */
export async function updateComplaintStatus(path, status) {
  try {
    const ref = doc(db, path);
    await updateDoc(ref, { status });
    console.log(`✅ Status updated to ${status}`);
    return true;
  } catch (err) {
    console.error("❌ Status update failed:", err.message);
    return false;
  }
}

/**
 * findComplaintByCustomId
 * @param {string} customId - Format CIV-YYYY-XXXXX
 */
export async function findComplaintByCustomId(customId) {
  try {
    const ref = collection(db, "complaints");
    const q   = query(ref, where("complaint_id", "==", customId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return {
      id: snap.docs[0].id,
      path: snap.docs[0].ref.path,
      ...snap.docs[0].data(),
    };
  } catch (err) {
    console.error("❌ Finder failed:", err.message);
    return null;
  }
}

/**
 * syncOverdueStatus
 * Reconciles temporal thresholds with persistent DB state.
 * Marks any non-resolved incident > 5 days old as OVERDUE.
 */
export async function syncOverdueStatus(complaints) {
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const updates = complaints.filter(c => {
    const age = now - (c.timestamp instanceof Date ? c.timestamp.getTime() : 0);
    return (
      c.status !== "RESOLVED" && 
      c.status !== "OVERDUE" && 
      age > FIVE_DAYS_MS
    );
  });

  if (updates.length === 0) return false;

  console.log(`⏳ Synchronizing ${updates.length} overdue records with Firestore...`);
  
  for (const c of updates) {
    await updateComplaintStatus(c.path, "OVERDUE");
  }

  return true;
}
