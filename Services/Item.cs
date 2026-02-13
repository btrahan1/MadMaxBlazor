using System;

namespace MadMaxBlazor.Services
{
    public class Item
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public string Slot { get; set; } = "NONE"; // HEAD, CHEST, LEGS, MAIN, OFF, NONE
        public int Cost { get; set; } = 0;
        public int BaseDamage { get; set; } = 0;
        
        // Stats
        public int BonusStr { get; set; } = 0;
        public int BonusDex { get; set; } = 0;
        public int BonusCon { get; set; } = 0;
        public int BonusInt { get; set; } = 0;
        
        public string GetIcon()
        {
            if (string.IsNullOrEmpty(Slot)) return "❓";
            var icon = Slot.Trim().ToUpper() switch
            {
                "HEAD" => "🪖",
                "CHEST" => "👕",
                "BACK" => "🎒",
                "LEGS" => "👖",
                "FEET" => "👞",
                "MAIN" => "🗡️",
                "OFF" => "🛡️",
                "GLOVES" => "🧤",
                _ => "📦"
            };
            return icon;
        }

        public Item Clone()
        {
            Console.WriteLine($"Cloning item: {Name} (Slot: {Slot})");
            return new Item
            {
                Name = this.Name,
                Description = this.Description,
                Slot = this.Slot,
                Cost = this.Cost,
                BaseDamage = this.BaseDamage,
                BonusStr = this.BonusStr,
                BonusDex = this.BonusDex,
                BonusCon = this.BonusCon,
                BonusInt = this.BonusInt
            };
        }
    }
}
