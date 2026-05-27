import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import validator from 'validator';
import {
  ARTIST_STATUS_VALUES,
  USER_ROLE_VALUES,
  USER_ROLES,
} from '../utils/userRoles.js';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "РџРѕС‚СЂРµР±РёС‚РµР»СЃРєРѕС‚Рѕ РёРјРµ Рµ Р·Р°РґСЉР»Р¶РёС‚РµР»РЅРѕ!"],
      trim: true,
      minLength: [3, "РџРѕС‚СЂРµР±РёС‚РµР»СЃРєРѕС‚Рѕ РёРјРµ С‚СЂСЏР±РІР° РґР° Рµ РїРѕРЅРµ 3 СЃРёРјРІРѕР»Р°!"],
      maxLength: [15, "РџРѕС‚СЂРµР±РёС‚РµР»СЃРєРѕС‚Рѕ РёРјРµ РЅРµ РјРѕР¶Рµ РґР° Рµ РїРѕРІРµС‡Рµ РѕС‚ 15 СЃРёРјРІРѕР»Р°!"],
    },
    email: {
      type: String,
      required: [true, "Email Р°РґСЂРµСЃСЉС‚ Рµ Р·Р°РґСЉР»Р¶РёС‚РµР»РµРЅ!"],
      trim: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "РќРµРІР°Р»РёРґРµРЅ email Р°РґСЂРµСЃ!",
      },
    },
    password: {
      type: String,
      required: [true, "РџР°СЂРѕР»Р°С‚Р° Рµ Р·Р°РґСЉР»Р¶РёС‚РµР»РЅР°!"],
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: USER_ROLES.CUSTOMER,
      index: true,
    },
    artistStatus: {
      type: String,
      enum: ARTIST_STATUS_VALUES,
      default: undefined,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
