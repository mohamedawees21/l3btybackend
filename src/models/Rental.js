// backend/src/models/Rental.js
const Rental = {
  customer_name: { type: String, required: true },
  customer_phone: { type: String },
  game_id: { type: Number, required: true },
  branch_id: { type: Number, required: true },
  employee_id: { type: Number, required: true },
  employee_name: { type: String },
  duration_minutes: { type: Number, required: true },
  start_time: { type: Date, required: true },
  end_time: { type: Date },
  total_amount: { type: Number, required: true },
  deposit_amount: { type: Number, default: 0 },
  payment_method: { type: String, default: 'cash' },
  status: { type: String, default: 'نشط' },
  notes: { type: String },
  rental_number: { type: String, unique: true }
};