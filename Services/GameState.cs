using System;

namespace MadMaxBlazor.Services
{
    public class GameState
    {
        public float Fuel { get; set; } = 100f;
        public float MaxFuel { get; set; } = 100f;
        public int Scrap { get; set; } = 0;
        public int Water { get; set; } = 100; // HP
        public bool IsDead => Water <= 0;

        public int Level { get; set; } = 1;
        public int XP { get; set; } = 0;
        public int StatPoints { get; set; } = 0;

        public int Strength { get; set; } = 10;
        public int Dexterity { get; set; } = 10;
        public int Constitution { get; set; } = 10;
        public int Intelligence { get; set; } = 10;
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
            NotifyStateChanged();
        }

        public void Revive()
        {
            Water = 100;
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

        private void NotifyStateChanged() => OnChange?.Invoke();
    }
}
