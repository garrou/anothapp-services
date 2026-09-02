import {describe, it, expect} from "vitest";
import ApiPerson from "./apiPerson.js";

describe("ApiPerson", () => {
    it("maps a full person response", () => {
        const person = new ApiPerson({
            id: "34100",
            name: "Rami Malek",
            birthday: "1981-05-12",
            deathday: null,
            nationality: "États-Unis",
            description: "Acteur américain.",
            poster: "https://pictures.betaseries.com/persons/rami.jpg",
            shows: [{show: {id: 1, title: "Mr Robot", creation: "2015", seasons: "4", episodes: "45"}}],
        });

        expect(person.id).toBe(34100);
        expect(person.name).toBe("Rami Malek");
        expect(person.series).toHaveLength(1);
        expect(person.series[0].title).toBe("Mr Robot");
    });

    it("does not crash when BetaSeries returns an empty array instead of a person (unknown id)", () => {
        const person = new ApiPerson([]);

        expect(Number.isNaN(person.id)).toBe(true);
        expect(person.name).toBeUndefined();
        expect(person.series).toEqual([]);
    });
});
