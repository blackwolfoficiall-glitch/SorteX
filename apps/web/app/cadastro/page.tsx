"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Header from "@/components/Header";

import SearchBar from "@/components/home/SearchBar";
import CampaignCard from "@/components/home/CampaignCard";
import SectionTitle from "@/components/home/SectionTitle";

import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  CreditCard,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
} from "lucide-react";