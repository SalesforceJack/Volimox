import { EXAMPLE_LIMO_AIRPORT_MIN_BASE_USD } from "./config"
import type { ExampleLimoRouteMetrics, ExampleLimoServiceType, ExampleLimoVehicleName } from "./types"
import type { ExampleLimoSettings } from "./config"

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function basePriceFromRoute(route: ExampleLimoRouteMetrics, settings: ExampleLimoSettings, serviceType: ExampleLimoServiceType) {
  let calculated = settings.baseFare + route.distanceMiles * settings.pricePerMile
  if (serviceType !== "special_event") calculated += Math.max(0, route.durationMinutes - route.staticDurationMinutes) * 1.5
  calculated = Math.max(calculated, settings.minFare)
  if (serviceType === "airport_arrival" || serviceType === "airport_departure") calculated = Math.max(calculated, settings.airportMinBaseFare || EXAMPLE_LIMO_AIRPORT_MIN_BASE_USD)
  return calculated
}

function vehicleMultiplier(vehicle: ExampleLimoVehicleName, settings: ExampleLimoSettings) {
  return settings.vehicleMultipliers[vehicle] || (vehicle === "Large SUV" ? settings.vehicleMultipliers["Premium SUV"] : settings.vehicleMultipliers["Luxury Sedan"]) || 1
}

export function routePortionForVehicle(vehicle: ExampleLimoVehicleName, route: ExampleLimoRouteMetrics, settings: ExampleLimoSettings, serviceType: ExampleLimoServiceType) {
  if (vehicle === "Large SUV") {
    // Proton rounds the Sedan base before applying the SUV multiplier. Keep
    // that intermediate rounding so round-trip totals and toll-adjacent fares
    // remain byte-for-byte compatible with the reference engine.
    return Number((routePortionForVehicle("Luxury Sedan", route, settings, serviceType) * vehicleMultiplier(vehicle, settings)).toFixed(2))
  }
  const rate = settings.vehicleTimeMileRatesByClass[vehicle] || settings.vehicleTimeMileRatesByClass["Luxury Sedan"]
  const trafficMinutes = serviceType === "special_event" ? 0 : Math.max(0, route.durationMinutes - route.staticDurationMinutes)
  const calculated = route.distanceMiles * rate.perMile + trafficMinutes * rate.perMinute
  const withMinimum = Math.max(calculated, settings.minFare * vehicleMultiplier(vehicle, settings))
  return serviceType === "airport_arrival" || serviceType === "airport_departure" ? Math.max(withMinimum, settings.airportMinBaseFare) : withMinimum
}

export function hourlyPriceForVehicle(vehicle: ExampleLimoVehicleName, settings: ExampleLimoSettings, hours: number) {
  return settings.hourlyRate * hours * vehicleMultiplier(vehicle, settings)
}

export function priceVehicle(args: {
  vehicleName: ExampleLimoVehicleName
  serviceType: ExampleLimoServiceType
  routes: ExampleLimoRouteMetrics[]
  hours: number
  settings: ExampleLimoSettings
}) {
  const { vehicleName, serviceType, routes, hours, settings } = args
  if (serviceType === "hourly") {
    const vehicleRoutePrice = Math.ceil(hourlyPriceForVehicle(vehicleName, settings, hours))
    const subtotal = vehicleRoutePrice
    const gratuityAmount = Math.round(subtotal * settings.gratuityRate)
    const taxAmount = Math.round(subtotal * settings.salesTaxRate)
    return {
      baseRoutePrice: Math.ceil(settings.hourlyRate * hours),
      vehicleRoutePrice,
      subtotal,
      gratuityAmount,
      taxAmount,
      totalPrice: subtotal + gratuityAmount + taxAmount,
      miles: 0,
      durationMinutes: hours * 60,
      trafficMultiplier: 1,
      tollAmount: 0,
    }
  }

  // Proton computes each route leg as its own quote and then adds the legs.
  // Rounding only after summing both legs changes tolls, gratuity, and tax by a
  // dollar at common half-cent boundaries, so preserve the per-leg sequence.
  const legs = routes.map((route) => {
    const baseRoutePrice = Math.ceil(basePriceFromRoute(route, settings, serviceType))
    const vehicleRoutePrice = Math.ceil(routePortionForVehicle(vehicleName, route, settings, serviceType))
    const tollAmount = Math.round(route.tollAmount)
    const subtotal = vehicleRoutePrice + tollAmount
    return {
      baseRoutePrice,
      vehicleRoutePrice,
      tollAmount,
      subtotal,
      gratuityAmount: Math.round(subtotal * settings.gratuityRate),
      taxAmount: Math.round(subtotal * settings.salesTaxRate),
    }
  })
  const baseRoutePrice = legs.reduce((sum, leg) => sum + leg.baseRoutePrice, 0)
  const vehicleRoutePrice = legs.reduce((sum, leg) => sum + leg.vehicleRoutePrice, 0)
  const tollAmount = legs.reduce((sum, leg) => sum + leg.tollAmount, 0)
  const subtotal = legs.reduce((sum, leg) => sum + leg.subtotal, 0)
  const gratuityAmount = legs.reduce((sum, leg) => sum + leg.gratuityAmount, 0)
  const taxAmount = legs.reduce((sum, leg) => sum + leg.taxAmount, 0)
  const distance = routes.reduce((sum, route) => sum + route.distanceMiles, 0)
  const duration = routes.reduce((sum, route) => sum + route.durationMinutes, 0)
  const staticDuration = routes.reduce((sum, route) => sum + route.staticDurationMinutes, 0)
  return {
    baseRoutePrice,
    vehicleRoutePrice,
    subtotal,
    gratuityAmount,
    taxAmount,
    totalPrice: subtotal + gratuityAmount + taxAmount,
    miles: Number(distance.toFixed(2)),
    durationMinutes: Number(duration.toFixed(1)),
    trafficMultiplier: staticDuration > 0 ? Number((duration / staticDuration).toFixed(2)) : 1,
    tollAmount,
  }
}

export function formatUsd(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`
}

export function formatDualAgentSayPrice(options: Partial<Record<ExampleLimoVehicleName, { quotedTotalUsd: number }>>, miles: number, serviceType: ExampleLimoServiceType, durationMinutes: number) {
  const sedan = options["Luxury Sedan"]
  const suv = options["Large SUV"]
  if (serviceType === "hourly") {
    const hours = (durationMinutes / 60).toFixed(1).replace(/\.0$/, "")
    if (sedan && suv) return `I have two options for ${hours} hours: Luxury Sedan is ${formatUsd(sedan.quotedTotalUsd)}, and Large SUV is ${formatUsd(suv.quotedTotalUsd)}, all-inclusive. Which one would you like?`
    if (suv) return `The Large SUV is the right fit for your party — ${formatUsd(suv.quotedTotalUsd)} for ${hours} hours, all-inclusive. Would you like to continue with the SUV?`
    if (sedan) return `The Luxury Sedan is ${formatUsd(sedan.quotedTotalUsd)} for ${hours} hours, all-inclusive. Would you like to continue with the sedan?`
  }
  if (sedan && suv) return `I have two options: Luxury Sedan is ${formatUsd(sedan.quotedTotalUsd)}, and Large SUV is ${formatUsd(suv.quotedTotalUsd)}, all-inclusive. Which one would you like?`
  if (suv) return `The Large SUV is the right fit for your party — ${formatUsd(suv.quotedTotalUsd)}, all-inclusive. Would you like to continue with the SUV?`
  if (sedan) return `The Luxury Sedan is ${formatUsd(sedan.quotedTotalUsd)}, all-inclusive. Would you like to continue with the sedan?`
  return "I could not find an available vehicle class for that passenger and luggage count. Let me connect you with dispatch."
}
