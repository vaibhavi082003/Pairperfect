const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    fullName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    dob: { type: String, required: true }, // String रखने से डेट पार्सिंग एरर नहीं आएगा
    maritalStatus: { 
      type: String, 
      enum: ["Never Married", "Divorced", "Widowed", "Awaiting Divorce"], 
      default: "Never Married" 
    },
    height: { type: Number },
    weight: { type: Number },
    complexion: { type: String },
    phone: { type: String, required: true },

    religion: { type: String, required: true },
    caste: { type: String },
    subCaste: { type: String },
    motherTongue: { type: String },
    manglik: { 
      type: String, 
      enum: ["Yes", "No", "Don't Know", "Anshik Manglik"], 
      default: "Don't Know" 
    },

    education: { type: String, required: true },
    occupation: { type: String },
    company: { type: String },
    annualIncome: { type: String },

    city: { type: String, required: true },
    state: { type: String },
    country: { type: String, default: "India" },

    fatherName: { type: String },
    fatherOccupation: { type: String },
    motherName: { type: String },
    motherOccupation: { type: String },
    siblings: { type: Number, default: 0 },
    familyType: { type: String, enum: ["Joint", "Nuclear"], default: "Nuclear" },

    diet: { 
      type: String, 
      enum: ["Vegetarian", "Non-Vegetarian", "Eggetarian", "Vegan", "Jain"], 
      default: "Vegetarian" 
    },
    smoking: { type: String, enum: ["No", "Yes", "Occasionally"], default: "No" },
    drinking: { type: String, enum: ["No", "Yes", "Occasionally"], default: "No" },

    about: { type: String, maxlength: 1000 },
    partnerPreference: { type: String, maxlength: 1000 },
    photoUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);