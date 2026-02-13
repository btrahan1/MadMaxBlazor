using System;

namespace MadMaxBlazor.Services
{
    public class GameState
    {
        public float Fuel { get; set; } = 100f;
        public float MaxFuel { get; set; } = 100f;
        public int Scrap { get; set; } = 0;
        public int VehicleHealth { get; set; } = 100;
        public int MaxVehicleHealth => 100 + (VehicleArmorLevel - 1) * 50;
        public int Water { get; set; } = 100; // HP
        public int MaxHealth => GetTotalStat("CON") * 10;
        public bool IsDead => Water <= 0;

        public int Level { get; set; } = 1;
        public int XP { get; set; } = 0;
        public int StatPoints { get; set; } = 0;

        public int Strength { get; set; } = 10;
        public int Dexterity { get; set; } = 10;
        public int Constitution { get; set; } = 10;
        public int Intelligence { get; set; } = 10;
        public int Stamina { get; set; } = 100;
        public int MaxStamina => GetTotalStat("CON") * 10;
        public int Mana { get; set; } = 100;
        public int MaxMana => GetTotalStat("INT") * 10;
        public int Wisdom { get; set; } = 10;
        public int Charisma { get; set; } = 10;

        // Inventory and Equipment
        public List<Item> Inventory { get; set; } = new List<Item>();
        public Dictionary<string, Item?> Equipment { get; set; } = new Dictionary<string, Item?>()
        {
            { "HEAD", null },
            { "CHEST", null },
            { "BACK", null },
            { "LEGS", null },
            { "FEET", null },
            { "MAIN", null },
            { "OFF", null },
            { "GLOVES", null }
        };

        // Vehicle Upgrades
        public int VehicleArmorLevel { get; set; } = 1;
        public int VehicleWeaponLevel { get; set; } = 1;
        public int VehicleEngineLevel { get; set; } = 1;

        public event Action OnChange;
        public event Action OnLevelUp;

        public int GetXPToNextLevel()
        {
            // Simple exponential: 300, 900, 2700...
            return (int)(300 * Math.Pow(3, Level - 1));
        }

        public void AddXP(int amount)
        {
            if (IsDead) return;
            XP += amount;
            while (XP >= GetXPToNextLevel())
            {
                LevelUp();
            }
            NotifyStateChanged();
        }

        private void LevelUp()
        {
            Level++;
            StatPoints += 2;
            OnLevelUp?.Invoke();
            // We don't reset XP, it's cumulative in this model
        }

        public void UpdateHealth(int hp)
        {
            Water = hp;
            if (Water < 0) Water = 0;
            if (Water > MaxHealth) Water = MaxHealth;
            NotifyStateChanged();
        }

        public void UpdateStamina(int amount)
        {
            Stamina = amount;
            if (Stamina < 0) Stamina = 0;
            if (Stamina > MaxStamina) Stamina = MaxStamina;
            NotifyStateChanged();
        }

        public void UpdateMana(int amount)
        {
            Mana = amount;
            if (Mana < 0) Mana = 0;
            if (Mana > MaxMana) Mana = MaxMana;
            NotifyStateChanged();
        }

        public bool CastHeal()
        {
            int wisdom = GetTotalStat("WIS");
            if (Mana < wisdom) return false;
            if (Water >= MaxHealth) return false;

            Mana -= wisdom;
            Water += wisdom;
            if (Water > MaxHealth) Water = MaxHealth;
            
            NotifyStateChanged();
            return true;
        }

        public void Revive()
        {
            Water = MaxHealth;
            Stamina = MaxStamina;
            Mana = MaxMana;
            NotifyStateChanged();
        }

        public bool RefillVitals()
        {
            int missingHP = MaxHealth - Water;
            int missingStam = MaxStamina - Stamina;
            int missingMana = MaxMana - Mana;
            int totalCost = missingHP + missingStam + missingMana;

            if (totalCost <= 0) return true; // Already full
            if (Scrap < totalCost) return false;

            Scrap -= totalCost;
            Water = MaxHealth;
            Stamina = MaxStamina;
            Mana = MaxMana;

            NotifyStateChanged();
            return true;
        }

        public bool RepairVehicle()
        {
            int missingHP = MaxVehicleHealth - VehicleHealth;
            if (missingHP <= 0) return true;

            if (Scrap < missingHP) return false;

            Scrap -= missingHP;
            VehicleHealth = MaxVehicleHealth;

            NotifyStateChanged();
            return true;
        }

        public void UpdateVehicleHealth(int amount)
        {
            VehicleHealth = amount;
            if (VehicleHealth < 0) VehicleHealth = 0;
            if (VehicleHealth > MaxVehicleHealth) VehicleHealth = MaxVehicleHealth;
            NotifyStateChanged();
        }

        public void Reset()
        {
            Fuel = 100f;
            MaxFuel = 100f;
            Scrap = 0;
            Water = 100;
            Level = 1;
            XP = 0;
            StatPoints = 0;
            Strength = 10;
            Dexterity = 10;
            Constitution = 10;
            Intelligence = 10;
            Wisdom = 10;
            Charisma = 10;
            Inventory = new List<Item>();
            Equipment = new Dictionary<string, Item?>()
            {
                { "HEAD", null },
                { "CHEST", null },
                { "BACK", null },
                { "LEGS", null },
                { "FEET", null },
                { "MAIN", null },
                { "OFF", null },
                { "GLOVES", null }
            };
            VehicleArmorLevel = 1;
            VehicleWeaponLevel = 1;
            VehicleEngineLevel = 1;
            VehicleHealth = 100;
            MaxFuel = 100f;
            NotifyStateChanged();
        }

        public void LoadFrom(GameState other)
        {
            if (other == null) return;
            Fuel = other.Fuel;
            MaxFuel = other.MaxFuel;
            Scrap = other.Scrap;
            Water = other.Water;
            Level = other.Level;
            XP = other.XP;
            StatPoints = other.StatPoints;
            Strength = other.Strength;
            Dexterity = other.Dexterity;
            Constitution = other.Constitution;
            Intelligence = other.Intelligence;
            Wisdom = other.Wisdom;
            Charisma = other.Charisma;
            Stamina = other.Stamina;
            Mana = other.Mana;
            VehicleArmorLevel = other.VehicleArmorLevel;
            VehicleWeaponLevel = other.VehicleWeaponLevel;
            VehicleEngineLevel = other.VehicleEngineLevel;
            VehicleHealth = other.VehicleHealth;
            Inventory = other.Inventory != null ? new List<Item>(other.Inventory) : new List<Item>();
            if (other.Equipment != null)
            {
                foreach (var kvp in other.Equipment)
                {
                    if (Equipment.ContainsKey(kvp.Key))
                    {
                        Equipment[kvp.Key] = kvp.Value;
                    }
                }
            }
            NotifyStateChanged();
        }

        public void ConsumeFuel(float amount)
        {
            Fuel -= amount;
            if (Fuel < 0) Fuel = 0;
            NotifyStateChanged();
        }

        public void AddFuel(float amount)
        {
            Fuel += amount;
            if (Fuel > MaxFuel) Fuel = MaxFuel;
            NotifyStateChanged();
        }

        public void BuyItem(Item item)
        {
            if (Scrap >= item.Cost)
            {
                Scrap -= item.Cost;
                Inventory.Add(item);
                NotifyStateChanged();
            }
        }

        public void EquipItem(Item item)
        {
            if (!Inventory.Contains(item)) return;
            if (item.Slot == "NONE") return;

            // Unequip current
            if (Equipment.ContainsKey(item.Slot))
            {
                var current = Equipment[item.Slot];
                if (current != null)
                {
                    // Current stays in inventory, we just swap the reference
                }
            }

            Equipment[item.Slot] = item;
            NotifyStateChanged();
        }

        public void UnequipItem(string slot)
        {
            if (Equipment.ContainsKey(slot))
            {
                Equipment[slot] = null;
                NotifyStateChanged();
            }
        }

        public int GetTotalStat(string stat)
        {
            int baseStat = stat switch
            {
                "STR" => Strength,
                "DEX" => Dexterity,
                "CON" => Constitution,
                "INT" => Intelligence,
                "WIS" => Wisdom,
                "CHA" => Charisma,
                _ => 0
            };

            int bonus = 0;
            foreach (var item in Equipment.Values)
            {
                if (item == null) continue;
                bonus += stat switch
                {
                    "STR" => item.BonusStr,
                    "DEX" => item.BonusDex,
                    "CON" => item.BonusCon,
                    "INT" => item.BonusInt,
                    "WIS" => 0, // No items give WIS/CHA yet but let's be safe
                    "CHA" => 0,
                    _ => 0
                };
            }

            return baseStat + bonus;
        }

        public void AddScrap(int amount)
        {
            Scrap += amount;
            NotifyStateChanged();
        }

        public int GetWeaponDamage()
        {
            if (Equipment.ContainsKey("MAIN") && Equipment["MAIN"] != null)
            {
                return Equipment["MAIN"].BaseDamage;
            }
            return 0; // Unarmed or no weapon
        }

        public bool UpgradeVehicleComponent(string component)
        {
            int currentLevel = 0;
            if (component == "ENGINE") currentLevel = VehicleEngineLevel;
            if (component == "ARMOR") currentLevel = VehicleArmorLevel;
            if (component == "WEAPONS") currentLevel = VehicleWeaponLevel;

            if (currentLevel >= 3) return false;

            int cost = 0;
            if (component == "ENGINE") cost = currentLevel == 1 ? 200 : 500;
            if (component == "ARMOR") cost = currentLevel == 1 ? 150 : 400;
            if (component == "WEAPONS") cost = currentLevel == 1 ? 300 : 600;

            if (Scrap < cost) return false;

            Scrap -= cost;
            if (component == "ENGINE") VehicleEngineLevel++;
            if (component == "ARMOR") 
            {
                VehicleArmorLevel++;
                // Still increase MaxFuel slightly but main focus is health
                MaxFuel = 100f + (VehicleArmorLevel - 1) * 25f; 
                VehicleHealth = MaxVehicleHealth; // Fully repair on upgrade
            }
            if (component == "WEAPONS") VehicleWeaponLevel++;

            NotifyStateChanged();
            return true;
        }

        private void NotifyStateChanged() => OnChange?.Invoke();
    }
}
