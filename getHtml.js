const input = `

- hola
  que pasó
  - que
  - cosa
- Buano
  8. n
  2. n
  3. n
-
-
-

hhhh

`;

const listaNombres = input.split('\n');
const lista2 = []
const unorderlist = /^-\s/
const code = /^```|^\s\s\s\s/
const isblank = /^\s*$/
const orderlist = /^\s\s\s$|[0-9]\./
const normaltext = /^\s{1,3}[A-Za-z]|^[A-Za-z]+$/


const pipe = functions =>data=>{
  return functions.reduce((value,func)=>func(value),data)
}
const compose = (f,g) => (x) => f(g(x));


const UnorderList = pipe([x => x.replace(unorderlist,"<ul><li>"), 
x => x.concat("</li></ul>")])

const isBlank = pipe([x => x.replace(isblank,"</br>")])

const isCode = pipe([x => x.replace(code,"<code>"), x => x.concat("</code>")])

const OrderList = pipe([x => x.replace(orderlist,"<ol><li>"),
 x => x.concat( "</li></ol>"), x => x.trim()])

const NormalText = pipe([x => x.replace(/^\s\s\s$|[a-z]/,"<p>"), 
x => x.concat( "</p>"),x => x.trim()])


listaNombres.forEach( (valor, indice, array) => {

   valor.charAt(0)  === "-" && valor.charAt(1) === " "
    ? lista2.push(UnorderList(valor)) : 0

    code.test(valor) ?   lista2.push(isCode(valor)): 0

    isblank.test(valor) ? lista2.push(isBlank(valor)): 0

    orderlist.test(valor)  ?  lista2.push(OrderList(valor)):  0

    normaltext.test(valor) ?  lista2.push(NormalText(valor)):  0

});
 

const Tostring = (x) => x.toString();
const JoinArr = (x) => x.replace(/,/g,"\n");
const GetHtml = compose(JoinArr, Tostring);
GetHtml(lista2)
