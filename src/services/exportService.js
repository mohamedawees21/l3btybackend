// backend/src/services/exportService.js
const ExcelJS = require('exceljs');

const exportRentalsToExcel = async (filters) => {
  const workbook = new ExcelJS.Workbook();
  
  // ورقة التأجيرات
  const rentalsSheet = workbook.addWorksheet('التأجيرات');
  rentalsSheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'العميل', key: 'customer_name', width: 20 },
    { header: 'الهاتف', key: 'customer_phone', width: 15 },
    { header: 'اللعبة', key: 'game_name', width: 20 },
    { header: 'الفرع', key: 'branch_name', width: 15 },
    { header: 'المدة (دقيقة)', key: 'duration_minutes', width: 15 },
    { header: 'السعر', key: 'total_price', width: 15 },
    { header: 'الحالة', key: 'status', width: 15 },
    { header: 'تاريخ البدء', key: 'started_at', width: 20 },
    { header: 'الموظف', key: 'employee_name', width: 20 }
  ];
  
  // جلب البيانات
  const rentals = await Rental.findAll({
    where: filters,
    include: [
      { model: Game, attributes: ['name'] },
      { model: Branch, attributes: ['name'] },
      { model: User, as: 'employee', attributes: ['name'] }
    ]
  });
  
  // إضافة البيانات
  rentals.forEach(rental => {
    rentalsSheet.addRow({
      id: rental.id,
      customer_name: rental.customer_name,
      customer_phone: rental.customer_phone,
      game_name: rental.Game.name,
      branch_name: rental.Branch.name,
      duration_minutes: rental.duration_minutes,
      total_price: rental.total_price,
      status: rental.status,
      started_at: rental.started_at,
      employee_name: rental.employee.name
    });
  });
  
  // ورقة الملخص
  const summarySheet = workbook.addWorksheet('ملخص');
  
  return workbook;
};