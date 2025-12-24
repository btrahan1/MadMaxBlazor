using System;

namespace MadMaxBlazor.Services
{
    public class GameState
    {
        public float Fuel { get; set; } = 100f;
        public float MaxFuel { get; set; } = 100f;
        public int Scrap { get; set; } = 0;
        public int Water { get; set; } = 100; // HP

        public event Action OnChange;

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

        public void AddScrap(int amount)
        {
            Scrap += amount;
            NotifyStateChanged();
        }

        private void NotifyStateChanged() => OnChange?.Invoke();
    }
}
