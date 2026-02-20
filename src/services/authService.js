// backend/src/services/authService.js - إضافة
const createBranch = async (branchData) => {
  try {
    const result = await Branch.create(branchData);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  // ...الدوال الأخرى
  createBranch
};