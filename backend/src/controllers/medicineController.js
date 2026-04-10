const Medicine = require('../models/medicine');

const calculateMedicineStatus = (med) => {
  const today = new Date();
  const expiryDate = new Date(med.expiry_date);
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - today.getTime();
  const days_left = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status = 'In Stock';
  if (expiryDate < today) {
    status = 'Expired';
  } else if (med.quantity <= 3) {
    status = 'Critical';
  } else if (med.quantity <= med.min_stock) {
    status = 'Low';
  }

  return {
    ...med,
    days_left,
    status
  };
};

const getMedicines = async (req, res, next) => {
  try {
    const medicines = await Medicine.findAllByUserId(req.user.id);
    const formattedMedicines = medicines.map(calculateMedicineStatus);
    res.json(formattedMedicines);
  } catch (err) {
    next(err);
  }
};

const addMedicine = async (req, res, next) => {
  try {
    const { name, quantity, min_stock, expiry_date } = req.body;
    const medicine = await Medicine.create({
      user_id: req.user.id,
      name,
      quantity,
      min_stock,
      expiry_date
    });
    res.status(201).json(calculateMedicineStatus(medicine));
  } catch (err) {
    next(err);
  }
};

const updateMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, quantity, min_stock, expiry_date } = req.body;
    
    const updatedMedicine = await Medicine.update(id, req.user.id, {
      name,
      quantity,
      min_stock,
      expiry_date
    });

    if (!updatedMedicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    res.json(calculateMedicineStatus(updatedMedicine));
  } catch (err) {
    next(err);
  }
};

const deleteMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Medicine.delete(id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine
};
